<script setup>
import { ref, computed, onMounted, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'

import MapaDpg from '@rural-environmental-registry/map_component'
import VectorizationToolPanel from '@/components/map/VectorizationToolPanel.vue'
import AreasDisplayPanel from '@/components/map/AreasDisplayPanel.vue'

import mapHelpers from '@/config/map/helpers.ts'
import mapConfigurationDataImport from '@/config/map/layers.ts'
import {
  MapOptions,
  getTranslatedLayers,
  getTranslatedDescriptiveMemorial,
} from '@/config/map/constsMap.ts'
import { useLanguageContext } from '@/context/language/useLanguageContext'
import MapHandler from '@/config/map/mapHandlers.ts'
import { useFormContext } from '@/context/useFormContext'
import diffArea from '@/config/diff_area.json'

let mapHandler
const PROPERTY_KEY = diffArea.layer_code

const mapRef = ref(null)
const currentMapSetup = ref(mapConfigurationDataImport)
const vectorizedLayer = ref({})
const currentVectorizedLayer = ref({})
const currentMapStep = ref({})
const isLoading = ref(false)
const vectorizationPanelRef = ref(null)
const processingStatus = ref({
  isProcessing: false,
  processed: false,
})

const router = useRouter()
const route = useRoute()
const { getLanguage, language } = useLanguageContext()
const { validateRegistrationForm } = useFormContext()

const currentLayers = computed(() => getTranslatedLayers(getLanguage))

const showDescriptiveMemorial = ref(false)
const descriptiveMemorial = computed(() => {
  return {
    show: showDescriptiveMemorial.value,
    customTexts: getTranslatedDescriptiveMemorial(language.value),
  }
})

const displayedAreas = computed(() => {
  return Object.values(vectorizedLayer.value).filter((a) => a.vectorizedArea?.layer)
})

const currentGroup = computed(() => {
  return vectorizationPanelRef.value?.currentStep?.group?.key || currentMapStep.value?.group?.key
})

const isFormValid = computed(() => {
  const requiredLayers = Object.values(vectorizedLayer.value).filter((l) => l.rules.required)
  const areRequiredLayersVectorized = requiredLayers.every((l) => l.vectorizedArea?.layer)
  return areRequiredLayersVectorized && !isLoading.value && processingStatus.value.processed
})

const canProcessLayers = computed(() => {
  const requiredLayers = Object.values(vectorizedLayer.value).filter((l) => l.rules.required)
  const areRequiredLayersVectorized = requiredLayers.every((l) => l.vectorizedArea?.layer)

  return areRequiredLayersVectorized && !processingStatus.value.isProcessing
})

onMounted(() => {
  loadVectorizedLayers()
  mapHandler = new MapHandler(mapRef.value, mapHandlerCallback)
  restoreMapState()
})

const loadVectorizedLayers = () => {
  const groups = currentMapSetup.value.vectorizationGroups

  const vectorizedLayers = {}
  for (const group of groups) {
    const layersToVectorize = group.layersToVectorize

    for (const layer of layersToVectorize) {
      vectorizedLayers[layer.layerCode] = {
        ...layer,
        parentGroup: group.groupKey,
        vectorizedArea: null,
        isVisible: true,
      }
    }
  }
  vectorizedLayer.value = vectorizedLayers
}

const updateLayerData = (data) => {
  if (!data.layer?.options?.layerCode) return
  const { layerCode } = data.layer.options
  vectorizedLayer.value[layerCode].vectorizedArea = data.layer
  vectorizedLayer.value[layerCode].isVisible = vectorizedLayer.value[layerCode].isVisible ?? true
  processingStatus.value.processed = false
}

const refreshMap = () => {
  nextTick(() => {
    restoreMapState()
  })
}

// used to pass events from mapHandler
const mapHandlerCallback = (data) => {
  const events = {
    updatedLayer: updateLayerData,
    changedState: saveMapState,
    refreshMap: refreshMap,
    notifyRemovedLayers: notifyRemovedLayers,
    mapErrors: notifyMapErrors,
  }

  if (events[data.event]) {
    events[data.event]?.(data)
  }
}

const notifyMapErrors = (data) => {
  const { errorType } = data.error
  window.alert(getLanguage(`layers.${errorType}`))
}

const notifyRemovedLayers = (data) => {
  const { removedLayers } = data
  const layerNames = removedLayers
    .map((layerCode) => getLanguage(vectorizedLayer.value[layerCode].displayNameKey))
    .join(' | ')
  const removedLayerMessage = getLanguage('layers.layerRemoval').replace('{layers}', layerNames)

  window.alert(removedLayerMessage)
}

const saveMapState = () => {
  nextTick(() => {
    const currentStep = vectorizationPanelRef.value?.currentStep
    const layers = vectorizedLayer.value
    mapHelpers.saveMapState(layers, currentStep)
    currentMapStep.value = currentStep
  })
}

const restoreMapState = () => {
  const mapState = mapHelpers.loadMapState()
  if (!mapState) return

  const { currentStep, vectorizedLayers } = mapState

  for (const key in vectorizedLayers) {
    vectorizedLayer.value[key] = vectorizedLayers[key]
    vectorizedLayer.value[key].isVisible = vectorizedLayers[key].isVisible ?? true
    vectorizedLayer.value[key].vectorizedArea = mapHandler.processDrawingFromState(
      vectorizedLayers[key].vectorizedArea,
    )
  }

  mapHandler.ensurePropertyLayerBehindOthers()

  if (currentStep) {
    currentMapStep.value = currentStep
    vectorizationPanelRef.value?.toggleStep(currentStep.group.key)
  }

  mapHandler.centralizeMap()
}

const handleVectorizationLayerSelection = (data) => {
  saveMapState()
  mapHandler.displayTools(data.layer)
  showDescriptiveMemorial.value = !!data.layer

  if (!data.layer) return

  const { layerCode } = data.layer
  mapHelpers.scrollToMap()

  currentVectorizedLayer.value = vectorizedLayer.value[layerCode]
  currentVectorizedLayer.value.vectorizedArea = null

  mapHandler.handleDrawingControls(vectorizedLayer.value[layerCode])
}

const handleDrawingArea = (evt) => {
  const { type } = evt

  if (type !== 'created') return

  const processedLayer = mapHandler.processDrawingFromMapEvent(evt, currentVectorizedLayer.value)
  const { layerCode } = evt.layer.options

  vectorizedLayer.value[layerCode].vectorizedArea = processedLayer
  vectorizedLayer.value[layerCode].isVisible = true

  mapHandler.handleDrawingControls(vectorizedLayer.value[layerCode])
  showDescriptiveMemorial.value = false
}

// Behaves like a contract and children components can call the MapHandler methods without knowing its implementations
const layerControlInjection = {
  triggerEditing: (item) => {
    vectorizedLayer.value[item.layerCode].isEditing =
      !vectorizedLayer.value[item.layerCode].isEditing
    mapHandler.editLayer(item)
  },
  triggerDelete: (item) => {
    mapHandler.removeLayer(item)
    vectorizedLayer.value[item.layerCode].vectorizedArea = null
    mapHandler.displayTools(null)
    vectorizationPanelRef.value?.resetLayerSelection()

    const isProperty = item.layerCode === PROPERTY_KEY
    if (isProperty) {
      loadVectorizedLayers()
      currentVectorizedLayer.value = {}
      vectorizationPanelRef.value?.toggleStep()
    }
  },
  triggerVisibility: (layer) => {
    const { layerCode } = layer
    if (layerCode === PROPERTY_KEY) return

    const previousVectorized = vectorizedLayer.value[layerCode].vectorizedArea

    // pass the whole layer object so MapHandler can use either object or string
    const toggled = mapHandler.toggleLayerVisibility(layer)

    // if a layer object is returned (made visible), set it on the vectorized layer
    if (toggled) {
      const merged = { ...toggled }
      const bufferRef = toggled.buffer ?? previousVectorized?.buffer
      if (bufferRef !== undefined) {
        merged.buffer = bufferRef
      }
      vectorizedLayer.value[layerCode].vectorizedArea = merged
    }

    const isCurrentlyVisible = vectorizedLayer.value[layerCode].isVisible ?? true
    vectorizedLayer.value[layerCode].isVisible = !isCurrentlyVisible
  },

  triggerBufferVisibility: (bufferCode) => {
    mapHandler.toggleLayerVisibility(bufferCode)
  },
}

const submitMap = async () => {
  mapHandler.centralizeMap()

  setTimeout(async () => {
    /*
      nextTick and map events didn't seem to fix, so we use setTimeout
      to allow the map animation to finish before taking the snapshot
    */

    if (isFormValid.value && processingStatus.value.processed) {
      try {
        isLoading.value = true
        await mapHelpers.takeScreenshot()
        saveMapState()
        mapHelpers.updateFormData()
        validateRegistrationForm.isMapValid = true
        await router.push('/register/registrars_details')
      } catch (e) {
        console.error('Error updating formData in sessionStorage for API:', e)
      } finally {
        isLoading.value = false
      }
    }
  }, 500)
}

const processLayers = async () => {
  try {
    processingStatus.value.isProcessing = true
    vectorizedLayer.value = await mapHandler.processLayersOnAPI(vectorizedLayer.value)
    Object.keys(vectorizedLayer.value).forEach((layerCode) => {
      const layerState = vectorizedLayer.value[layerCode]
      if (!layerState || typeof layerState !== 'object' || !('vectorizedArea' in layerState)) return
      layerState.isVisible = layerState.isVisible ?? true
    })
    saveMapState()
    processingStatus.value.processed = true
  } catch (e) {
    console.error('Error processing layers in API:', e)
    processingStatus.value.processed = false
  } finally {
    processingStatus.value.isProcessing = false
  }
}

watch(
  language,
  (currentLang) => {
    nextTick(() => mapHandler.updateLanguage(currentLang))
  },
  { immediate: true },
)

watch(
  () => vectorizationPanelRef.value?.currentStep?.group?.key,
  (newGroupKey) => {
    if (newGroupKey && newGroupKey !== currentMapStep.value?.group?.key) {
      saveMapState()
    }
  },
)

watch(
  () => route.path,
  () => {
    if (route.path.includes('property_map')) {
      nextTick(() => {
        const mapState = mapHelpers.loadMapState()
        if (mapState?.currentStep) {
          currentMapStep.value = mapState.currentStep
          vectorizationPanelRef.value?.toggleStep(mapState.currentStep.group.key)
        }
      })
    }
  },
)
</script>

<template>
  <div class="px-3 flex flex-col gap-4">
    <VectorizationToolPanel
      :config="currentMapSetup.vectorizationGroups"
      :displayedAreas="displayedAreas"
      @vectorizationLayerSelected="handleVectorizationLayerSelection"
      ref="vectorizationPanelRef"
    />
    <div class="h-[70vh]" id="map-container">
      <MapaDpg
        ref="mapRef"
        disableLoading
        :descriptiveMemorial="descriptiveMemorial"
        :options="MapOptions"
        :layers="currentLayers"
        @onDrawing="handleDrawingArea"
      />
    </div>
    <AreasDisplayPanel
      :currentGroup="currentGroup"
      :displayedAreas="displayedAreas"
      :layerControls="layerControlInjection"
    />
    <div class="flex justify-end gap-3 mt-3">
      <button class="br-button primary" @click="processLayers" :disabled="!canProcessLayers">
        {{
          processingStatus.isProcessing
            ? getLanguage('mapComponents.propertyMapView.processing')
            : getLanguage('register.saveButton')
        }}
      </button>
      <button class="br-button primary" @click="submitMap" :disabled="!isFormValid">
        {{
          isLoading
            ? getLanguage('mapComponents.propertyMapView.processing')
            : getLanguage('register.nextButton')
        }}
      </button>
    </div>
  </div>
</template>
