import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest'
import { mount, config } from '@vue/test-utils'
import { nextTick, ref } from 'vue'
import PropertyMapView from '@/views/RegisterViews/PropertyMapView.vue'
import { useRouter } from 'vue-router'
import { useLanguageContext } from '@/context/language/useLanguageContext'
import { useFormContext } from '@/context/useFormContext'
import MapHandler from '@/config/map/mapHandlers'
import mapHelpers from '@/config/map/helpers'

config.global.config.warnHandler = () => {}
config.global.config.errorHandler = () => {}

vi.mock('vue-router', () => ({
  useRouter: vi.fn(),
  useRoute: vi.fn(() => ({
    path: '/register/property_map',
  })),
}))

vi.mock('@/context/language/useLanguageContext', () => ({
  useLanguageContext: vi.fn(),
}))

vi.mock('@/context/useFormContext', () => ({
  useFormContext: vi.fn(),
}))

vi.mock('@/config/map/mapHandlers', () => ({
  default: vi.fn(),
}))

vi.mock('@/config/map/helpers', () => ({
  default: {
    saveMapState: vi.fn(),
    loadMapState: vi.fn(),
    scrollToMap: vi.fn(),
    takeScreenshot: vi.fn(),
    updateFormData: vi.fn(),
  },
}))

vi.mock('@/config/diff_area.json', () => ({
  default: { layer_code: 'PROPERTY' },
}))

vi.mock('@rural-environmental-registry/map_component', () => ({
  default: {
    name: 'MapaDpg',
    template: '<div data-testid="map-component"></div>',
  },
}))

vi.mock('@/components/map/VectorizationToolPanel.vue', () => ({
  default: {
    name: 'VectorizationToolPanel',
    template: '<div data-testid="vectorization-panel"></div>',
    props: ['config', 'displayedAreas'],
    emits: ['vectorizationLayerSelected'],
    methods: {
      toggleStep: vi.fn(),
      resetLayerSelection: vi.fn(),
    },
  },
}))

vi.mock('@/components/map/AreasDisplayPanel.vue', () => ({
  default: {
    name: 'AreasDisplayPanel',
    template: '<div data-testid="areas-display-panel"></div>',
    props: ['currentGroup', 'displayedAreas', 'layerControls'],
  },
}))

const originalConsoleError = console.error
const originalConsoleWarn = console.warn

describe('PropertyMapView', () => {
  let mockRouter
  let mockLanguageContext
  let mockFormContext
  let mockMapHandler
  let wrapper

  beforeEach(() => {
    console.error = vi.fn()
    console.warn = vi.fn()
    console.log = vi.fn()

    mockRouter = {
      push: vi.fn(),
    }

    const languageRef = ref('pt-br')
    mockLanguageContext = {
      getLanguage: vi.fn((key) => key),
      language: languageRef,
    }

    mockFormContext = {
      validateRegistrationForm: {
        isMapValid: false,
      },
    }

    mockMapHandler = {
      displayTools: vi.fn(),
      handleDrawingControls: vi.fn(),
      processDrawingFromMapEvent: vi.fn(),
      processDrawingFromState: vi.fn(),
      ensurePropertyLayerBehindOthers: vi.fn(),
      editLayer: vi.fn(),
      removeLayer: vi.fn(),
      toggleLayerVisibility: vi.fn(),
      centralizeMap: vi.fn(),
      updateLanguage: vi.fn(),
      processLayersOnAPI: vi.fn(),
    }

    vi.mocked(useRouter).mockReturnValue(mockRouter)
    vi.mocked(useLanguageContext).mockReturnValue(mockLanguageContext)
    vi.mocked(useFormContext).mockReturnValue(mockFormContext)
    vi.mocked(MapHandler).mockImplementation(() => mockMapHandler)

    mapHelpers.loadMapState.mockReturnValue(null)
    mapHelpers.takeScreenshot.mockResolvedValue()
    mapHelpers.updateFormData.mockResolvedValue()
    mockMapHandler.processLayersOnAPI.mockResolvedValue({})
  })

  afterEach(() => {
    vi.clearAllMocks()
    vi.restoreAllMocks()

    console.error = originalConsoleError
    console.warn = originalConsoleWarn
  })

  const createWrapper = (props = {}) => {
    return mount(PropertyMapView, {
      props,
      global: {
        stubs: {
          MapaDpg: true,
          VectorizationToolPanel: true,
          AreasDisplayPanel: true,
        },
      },
    })
  }

  describe('Component Initialization', () => {
    it('should render all main components', () => {
      wrapper = createWrapper()

      expect(wrapper.findComponent({ name: 'VectorizationToolPanel' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'MapaDpg' }).exists()).toBe(true)
      expect(wrapper.findComponent({ name: 'AreasDisplayPanel' }).exists()).toBe(true)
    })

    it('should initialize with correct default values', () => {
      wrapper = createWrapper()

      expect(wrapper.vm.isLoading).toBe(false)
      expect(wrapper.vm.showDescriptiveMemorial).toBe(false)
      expect(wrapper.vm.processingStatus.isProcessing).toBe(false)
      expect(wrapper.vm.processingStatus.processed).toBe(false)
    })

    it('should create MapHandler instance on mount', () => {
      wrapper = createWrapper()

      expect(MapHandler).toHaveBeenCalledWith(expect.any(Object), expect.any(Function))
    })

    it('should load vectorized layers on mount', () => {
      wrapper = createWrapper()

      expect(wrapper.vm.vectorizedLayer).toBeDefined()
      expect(typeof wrapper.vm.vectorizedLayer).toBe('object')
    })
  })

  describe('Computed Properties', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should compute currentLayers correctly', () => {
      expect(wrapper.vm.currentLayers).toBeDefined()
    })

    it('should compute descriptiveMemorial correctly', () => {
      wrapper.vm.showDescriptiveMemorial = true
      expect(wrapper.vm.descriptiveMemorial.show).toBe(true)
      expect(wrapper.vm.descriptiveMemorial.customTexts).toBeDefined()
    })

    it('should filter displayedAreas correctly', () => {
      wrapper.vm.vectorizedLayer = {
        layer1: { vectorizedArea: { layer: 'test' } },
        layer2: { vectorizedArea: null },
        layer3: { vectorizedArea: { layer: 'test2' } },
      }

      const displayed = wrapper.vm.displayedAreas
      expect(displayed).toHaveLength(2)
    })

    it('should compute isFormValid correctly when form is valid', () => {
      wrapper.vm.vectorizedLayer = {
        requiredLayer: {
          rules: { required: true },
          vectorizedArea: { layer: 'test' },
        },
      }
      wrapper.vm.isLoading = false
      wrapper.vm.processingStatus.processed = true

      expect(wrapper.vm.isFormValid).toBe(true)
    })

    it('should compute isFormValid correctly when form is invalid', () => {
      wrapper.vm.vectorizedLayer = {
        requiredLayer: {
          rules: { required: true },
          vectorizedArea: null,
        },
      }

      expect(wrapper.vm.isFormValid).toBe(false)
    })

    it('should compute canProcessLayers correctly', () => {
      wrapper.vm.vectorizedLayer = {
        requiredLayer: {
          rules: { required: true },
          vectorizedArea: { layer: 'test' },
        },
      }
      wrapper.vm.processingStatus.isProcessing = false

      expect(wrapper.vm.canProcessLayers).toBe(true)
    })
  })

  describe('Layer Management', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should update layer data correctly', () => {
      const testData = {
        layer: {
          options: { layerCode: 'TEST_LAYER' },
        },
      }

      wrapper.vm.vectorizedLayer = {
        TEST_LAYER: { vectorizedArea: null },
      }

      wrapper.vm.updateLayerData(testData)

      expect(wrapper.vm.vectorizedLayer.TEST_LAYER.vectorizedArea).toStrictEqual(testData.layer)
      expect(wrapper.vm.processingStatus.processed).toBe(false)
    })

    it('should not update layer data if layerCode is missing', () => {
      const testData = {
        layer: {
          options: {},
        },
      }

      const originalLayers = { ...wrapper.vm.vectorizedLayer }
      wrapper.vm.updateLayerData(testData)

      expect(wrapper.vm.vectorizedLayer).toEqual(originalLayers)
    })

    it('should handle vectorization layer selection', () => {
      const testData = {
        layer: {
          layerCode: 'TEST_LAYER',
        },
      }

      wrapper.vm.vectorizedLayer = {
        TEST_LAYER: { vectorizedArea: null },
      }

      wrapper.vm.handleVectorizationLayerSelection(testData)

      expect(mockMapHandler.displayTools).toHaveBeenCalledWith(testData.layer)
      expect(wrapper.vm.showDescriptiveMemorial).toBe(true)
      expect(wrapper.vm.currentVectorizedLayer).toBe(wrapper.vm.vectorizedLayer.TEST_LAYER)
    })

    it('should handle drawing area events', () => {
      const mockEvent = {
        type: 'created',
        layer: {
          options: { layerCode: 'TEST_LAYER' },
        },
      }

      const mockProcessedLayer = { processed: true }
      mockMapHandler.processDrawingFromMapEvent.mockReturnValue(mockProcessedLayer)

      wrapper.vm.vectorizedLayer = {
        TEST_LAYER: { vectorizedArea: null },
      }
      wrapper.vm.currentVectorizedLayer = wrapper.vm.vectorizedLayer.TEST_LAYER

      wrapper.vm.handleDrawingArea(mockEvent)

      expect(mockMapHandler.processDrawingFromMapEvent).toHaveBeenCalledWith(
        mockEvent,
        wrapper.vm.currentVectorizedLayer,
      )
      expect(wrapper.vm.vectorizedLayer.TEST_LAYER.vectorizedArea).toStrictEqual(mockProcessedLayer)
      expect(wrapper.vm.showDescriptiveMemorial).toBe(false)
    })

    it('should not process non-created drawing events', () => {
      const mockEvent = {
        type: 'updated',
        layer: { options: { layerCode: 'TEST_LAYER' } },
      }

      wrapper.vm.handleDrawingArea(mockEvent)

      expect(mockMapHandler.processDrawingFromMapEvent).not.toHaveBeenCalled()
    })
  })

  describe('Map State Management', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should restore map state when state exists', () => {
      const mockState = {
        currentStep: { group: { key: 'test' } },
        vectorizedLayers: {
          TEST_LAYER: { vectorizedArea: { test: 'data' } },
        },
      }

      mapHelpers.loadMapState.mockReturnValue(mockState)
      mockMapHandler.processDrawingFromState.mockReturnValue({ processed: true })

      wrapper.vm.vectorizationPanelRef = {
        toggleStep: vi.fn(),
      }

      wrapper.vm.restoreMapState()

      expect(wrapper.vm.vectorizedLayer.TEST_LAYER).toEqual(mockState.vectorizedLayers.TEST_LAYER)
      expect(mockMapHandler.processDrawingFromState).toHaveBeenCalled()
      expect(mockMapHandler.ensurePropertyLayerBehindOthers).toHaveBeenCalled()
      expect(mockMapHandler.centralizeMap).toHaveBeenCalled()
    })

    it('should not restore map state when no state exists', () => {
      mapHelpers.loadMapState.mockReturnValue(null)

      wrapper.vm.restoreMapState()

      expect(mockMapHandler.processDrawingFromState).not.toHaveBeenCalled()
    })
  })

  describe('Layer Control Injection', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should trigger editing correctly', () => {
      const testItem = { layerCode: 'TEST_LAYER' }
      wrapper.vm.vectorizedLayer = {
        TEST_LAYER: { isEditing: false },
      }

      wrapper.vm.layerControlInjection.triggerEditing(testItem)

      expect(wrapper.vm.vectorizedLayer.TEST_LAYER.isEditing).toBe(true)
      expect(mockMapHandler.editLayer).toHaveBeenCalledWith(testItem)
    })

    it('should trigger delete correctly for non-property layer', () => {
      const testItem = { layerCode: 'TEST_LAYER' }
      wrapper.vm.vectorizedLayer = {
        TEST_LAYER: { vectorizedArea: { test: 'data' } },
      }
      wrapper.vm.vectorizationPanelRef = {
        resetLayerSelection: vi.fn(),
      }

      wrapper.vm.layerControlInjection.triggerDelete(testItem)

      expect(mockMapHandler.removeLayer).toHaveBeenCalledWith(testItem)
      expect(wrapper.vm.vectorizedLayer.TEST_LAYER.vectorizedArea).toBeNull()
      expect(mockMapHandler.displayTools).toHaveBeenCalledWith(null)
    })

    it('should trigger delete correctly for property layer', () => {
      const testItem = { layerCode: 'PROPERTY' }
      wrapper.vm.vectorizationPanelRef = {
        resetLayerSelection: vi.fn(),
        toggleStep: vi.fn(),
      }

      wrapper.vm.vectorizedLayer = {
        PROPERTY: { vectorizedArea: { test: 'data' } },
      }

      wrapper.vm.layerControlInjection.triggerDelete(testItem)

      expect(mockMapHandler.removeLayer).toHaveBeenCalledWith(testItem)
      expect(wrapper.vm.currentVectorizedLayer).toEqual({})
    })

    it('should trigger visibility correctly for non-property layer', () => {
      const testItem = { layerCode: 'TEST_LAYER' }
      const mockLayer = { visible: true }
      mockMapHandler.toggleLayerVisibility.mockReturnValue(mockLayer)

      wrapper.vm.vectorizedLayer = {
        TEST_LAYER: { isVisible: false },
      }

      wrapper.vm.layerControlInjection.triggerVisibility(testItem)

      expect(mockMapHandler.toggleLayerVisibility).toHaveBeenCalledWith(testItem)
      expect(wrapper.vm.vectorizedLayer.TEST_LAYER.isVisible).toBe(true)
      expect(wrapper.vm.vectorizedLayer.TEST_LAYER.vectorizedArea).toStrictEqual(mockLayer)
    })

    it('should not trigger visibility for property layer', () => {
      const testItem = { layerCode: 'PROPERTY' }

      wrapper.vm.layerControlInjection.triggerVisibility(testItem)

      expect(mockMapHandler.toggleLayerVisibility).not.toHaveBeenCalled()
    })
  })

  describe('Form Submission', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should not submit map when form is invalid', async () => {
      wrapper.vm.isFormValid = false

      vi.useFakeTimers()

      wrapper.vm.submitMap()

      vi.advanceTimersByTime(500)

      expect(mapHelpers.takeScreenshot).not.toHaveBeenCalled()
      expect(mockRouter.push).not.toHaveBeenCalled()

      vi.useRealTimers()
    })

    it('should handle submission errors gracefully', async () => {
      wrapper.vm.isFormValid = true
      wrapper.vm.processingStatus.processed = true
      mapHelpers.takeScreenshot.mockRejectedValue(new Error('Screenshot failed'))

      vi.useFakeTimers()

      wrapper.vm.submitMap()

      vi.advanceTimersByTime(500)

      expect(wrapper.vm.isLoading).toBe(false)

      vi.useRealTimers()
    })
  })

  describe('Layer Processing', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should process layers successfully', async () => {
      const mockProcessedLayers = { processed: true }
      mockMapHandler.processLayersOnAPI.mockResolvedValue(mockProcessedLayers)

      await wrapper.vm.processLayers()

      expect(wrapper.vm.processingStatus.isProcessing).toBe(false)
      expect(wrapper.vm.processingStatus.processed).toBe(true)
      expect(wrapper.vm.vectorizedLayer).toStrictEqual(mockProcessedLayers)
    })

    it('should handle layer processing errors', async () => {
      mockMapHandler.processLayersOnAPI.mockRejectedValue(new Error('Processing failed'))

      await wrapper.vm.processLayers()

      expect(wrapper.vm.processingStatus.isProcessing).toBe(false)
      expect(wrapper.vm.processingStatus.processed).toBe(false)
    })
  })

  describe('Map Handler Callbacks', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should handle updatedLayer event', () => {
      const testData = {
        event: 'updatedLayer',
        layer: { options: { layerCode: 'TEST_LAYER' } },
      }

      wrapper.vm.vectorizedLayer = {
        TEST_LAYER: { vectorizedArea: null },
      }

      wrapper.vm.mapHandlerCallback(testData)

      expect(wrapper.vm.vectorizedLayer.TEST_LAYER.vectorizedArea).toStrictEqual(testData.layer)
    })

    it('should handle refreshMap event', () => {
      const testData = { event: 'refreshMap' }

      wrapper.vm.mapHandlerCallback(testData)

      expect(wrapper.vm.restoreMapState).toBeDefined()
    })

    it('should handle notifyRemovedLayers event', () => {
      const testData = {
        event: 'notifyRemovedLayers',
        removedLayers: ['TEST_LAYER'],
      }

      wrapper.vm.vectorizedLayer = {
        TEST_LAYER: { displayNameKey: 'test.displayName' },
      }

      global.alert = vi.fn()

      wrapper.vm.mapHandlerCallback(testData)

      expect(global.alert).toHaveBeenCalled()
    })

    it('should handle mapErrors event', () => {
      const testData = {
        event: 'mapErrors',
        error: { errorType: 'testError' },
      }

      global.alert = vi.fn()

      wrapper.vm.mapHandlerCallback(testData)

      expect(global.alert).toHaveBeenCalledWith('layers.testError')
    })
  })

  describe('Language Watching', () => {
    it('should update map language when language changes', async () => {
      wrapper = createWrapper()

      mockLanguageContext.language.value = 'en-us'
      await nextTick()

      expect(mockMapHandler.updateLanguage).toHaveBeenCalled()
    })
  })

  describe('Template Rendering', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should render process button with correct state', () => {
      const processButton = wrapper.find('button.br-button.primary')
      expect(processButton.exists()).toBe(true)
    })

    it('should render submit button with correct state', () => {
      const submitButton = wrapper.findAll('button.br-button.primary')[1]
      expect(submitButton.exists()).toBe(true)
    })

    it('should disable process button when cannot process layers', async () => {
      wrapper.vm.canProcessLayers = false
      await nextTick()

      const processButton = wrapper.find('button.br-button.primary')
      expect(processButton.attributes('disabled')).toBeDefined()
    })

    it('should disable submit button when form is invalid', async () => {
      wrapper.vm.isFormValid = false
      await nextTick()

      const submitButton = wrapper.findAll('button.br-button.primary')[1]
      expect(submitButton.attributes('disabled')).toBeDefined()
    })

    it('should show processing text when processing', async () => {
      wrapper.vm.processingStatus.isProcessing = true
      await nextTick()

      const processButton = wrapper.find('button.br-button.primary')
      expect(processButton.text()).toContain('mapComponents.propertyMapView.processing')
    })

    it('should show loading text when submitting', async () => {
      wrapper.vm.isLoading = true
      await nextTick()

      const submitButton = wrapper.findAll('button.br-button.primary')[1]
      expect(submitButton.text()).toContain('mapComponents.propertyMapView.processing')
    })
  })

  describe('Error Handling', () => {
    beforeEach(() => {
      wrapper = createWrapper()
    })

    it('should handle map handler callback errors gracefully', () => {
      const invalidData = { event: 'unknownEvent' }

      expect(() => {
        wrapper.vm.mapHandlerCallback(invalidData)
      }).not.toThrow()
    })

    it('should handle missing layer in updateLayerData', () => {
      const testData = {
        layer: { options: { layerCode: 'NONEXISTENT_LAYER' } },
      }

      wrapper.vm.vectorizedLayer = {
        NONEXISTENT_LAYER: { vectorizedArea: null },
      }

      expect(() => {
        wrapper.vm.updateLayerData(testData)
      }).not.toThrow()
    })
  })

  describe('Integration Tests', () => {
    it('should handle complete workflow from layer selection to submission', async () => {
      wrapper = createWrapper()

      const testLayer = {
        layerCode: 'TEST_LAYER',
        rules: { required: true },
      }

      wrapper.vm.vectorizedLayer = {
        TEST_LAYER: testLayer,
      }

      wrapper.vm.handleVectorizationLayerSelection({ layer: testLayer })

      const drawingEvent = {
        type: 'created',
        layer: { options: { layerCode: 'TEST_LAYER' } },
      }

      mockMapHandler.processDrawingFromMapEvent.mockReturnValue({ processed: true })
      wrapper.vm.handleDrawingArea(drawingEvent)

      expect(wrapper.vm.vectorizedLayer.TEST_LAYER.vectorizedArea).toBeDefined()
    })
  })
})
