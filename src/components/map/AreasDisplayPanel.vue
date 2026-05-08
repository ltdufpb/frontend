<script setup>
import { computed, ref } from 'vue'
import { useLanguageContext } from '@/context/language/useLanguageContext'
import diffArea from '@/config/diff_area.json'

const mainLayer = ref(diffArea.layer_code)

const { getLanguage } = useLanguageContext()

const getLanguageText = (keyOrText, fallbackText) => {
  if (!keyOrText) return fallbackText || ''
  const translated = getLanguage(keyOrText)

  if (translated === keyOrText && fallbackText && keyOrText !== fallbackText) {
    return fallbackText
  }
  return translated
}

const props = defineProps({
  displayedAreas: {
    type: Array,
    required: true,
  },
  layerControls: {
    type: Object,
    required: true,
  },
  currentGroup: String,
})

const handleToggleVisibility = (item) => {
  if (item.isEditing) return
  props.layerControls.triggerVisibility(item)
}

const handleRequestEdit = (item) => {
  if (!item.isVisible && !item.isEditing) return
  props.layerControls.triggerEditing(item)
}

const handleRequestDelete = (item) => {
  props.layerControls.triggerDelete(item)
}

const displayPanel = computed(() => props.displayedAreas.length)

const areaText = (item) => {
  if (!item.vectorizedArea?.info[item?.rules.geometricUnit]?.value) {
    return getLanguage('mapComponents.areasDisplayPanel.notApplicable')
  }

  return item.vectorizedArea.info[item.rules.geometricUnit].formatted
}

const bufferAreaText = (value) => {
  return `${value.toFixed(2)} ha`
}

const handleToggleBufferVisibility = (item) => {
  item.vectorizedArea.buffer.isHidden = !item.vectorizedArea.buffer.isHidden
  const bufferCode = item.vectorizedArea.buffer.properties.layerCode
  props.layerControls.triggerBufferVisibility(bufferCode)
}

const canEdit = (item) => {
  return item.parentGroup === props.currentGroup
}
</script>

<template>
  <div
    v-if="displayPanel"
    class="areas-panel w-full p-2 border border-[#ccc] rounded-lg shadow-md bg-[#f9f9f9] max-h-[40rem] overflow-y-auto mt-2"
  >
    <h4 class="text-md font-semibold mb-3">
      {{ getLanguage('mapComponents.areasDisplayPanel.title') }}
    </h4>
    <ul class="space-y-2">
      <template v-for="item in displayedAreas" :key="item.layerCode">
        <li
          v-if="!item.rules.hidden"
          class="flex items-center justify-between p-2 border rounded-md hover:bg-gray-50"
        >
          <div class="flex items-center space-x-3">
            <button
              v-if="item.layerCode !== mainLayer"
              @click="handleToggleVisibility(item)"
              :title="
                item.isVisible
                  ? getLanguage('mapComponents.areasDisplayPanel.hideLayer')
                  : getLanguage('mapComponents.areasDisplayPanel.showLayer')
              "
            >
              <i v-if="item.isVisible" class="fas fa-eye text-gray-600 hover:text-blue-600" />
              <i v-else class="fas fa-eye-slash text-gray-600 hover:text-blue-600" />
            </button>
            <span v-else class="w-[24px]" />
            <span
              v-if="item.rules?.style?.color"
              class="color-swatch h-3 w-3 rounded-full inline-block mr-1 border border-gray-400"
              :style="{ backgroundColor: item.rules.style.color }"
              :title="getLanguage('mapComponents.areasDisplayPanel.layerColorTitle')"
            />
            <span class="text-sm font-medium">{{
              getLanguageText(item.displayNameKey, item.displayName)
            }}</span>
          </div>
          <div class="flex items-center space-x-3">
            <span class="text-sm text-gray-700">{{ areaText(item) }}</span>
            <div class="w-5 h-5">
              <button
                v-if="!item.isApiDerived"
                class="flex items-center justify-center w-full h-full"
                @click="handleRequestEdit(item)"
                :title="getLanguage('mapComponents.areasDisplayPanel.editLayer')"
              >
                <i
                  v-if="!item.isVisible && !item.isEditing"
                  class="fas fa-times text-red-600 text-xs"
                />
                <i
                  v-else-if="!item.isEditing"
                  class="fas fa-pen text-gray-600 hover:text-green-600 text-xs"
                />
                <i v-else class="fas fa-check text-green-600 text-xs" />
              </button>
            </div>
            <button
              v-if="canEdit(item)"
              @click="handleRequestDelete(item)"
              :title="getLanguage('mapComponents.areasDisplayPanel.removeLayer')"
            >
              <i class="fas fa-trash text-gray-600 hover:text-red-600 text-xs" />
            </button>
          </div>
        </li>
        <li
          v-if="!item.rules.hidden && item?.vectorizedArea?.buffer"
          class="flex items-center justify-between p-2 pl-4 border rounded-md hover:bg-gray-50"
        >
          <div class="flex items-center space-x-3">
            <button
              @click="handleToggleBufferVisibility(item)"
              :title="
                item.vectorizedArea.buffer.isHidden
                  ? getLanguage('mapComponents.areasDisplayPanel.showLayer')
                  : getLanguage('mapComponents.areasDisplayPanel.hideLayer')
              "
            >
              <i
                v-if="item.vectorizedArea.buffer.isHidden"
                class="fas fa-eye-slash text-gray-600 hover:text-blue-600"
              />
              <i v-else class="fas fa-eye text-gray-600 hover:text-blue-600" />
            </button>
            <span
              v-if="item.rules?.buffer?.style?.color"
              class="color-swatch h-3 w-3 rounded-full inline-block mr-1 border border-gray-400"
              :style="{ backgroundColor: item.rules?.buffer?.style?.color }"
              :title="getLanguage('mapComponents.areasDisplayPanel.layerColorTitle')"
            />
            <span class="text-sm font-medium">{{
              getLanguageText(item.rules.buffer.displayNameKey, item.rules.buffer.displayName)
            }}</span>
          </div>
          <div class="flex items-center space-x-3">
            <span class="text-sm text-gray-700">{{
              bufferAreaText(item.vectorizedArea.buffer.properties.area)
            }}</span>
            <span class="w-4 h-5 mr-6" />
          </div>
        </li>
      </template>
    </ul>
  </div>
</template>
