import { mount, VueWrapper } from '@vue/test-utils'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import AreasDisplayPanel from '@/components/map/AreasDisplayPanel.vue'

vi.mock('@/context/language/useLanguageContext', () => ({
  useLanguageContext: () => ({
    getLanguage: (key: string) => key,
  }),
}))

describe('AreasDisplayPanel.vue', () => {
  let wrapper: VueWrapper<any>
  const mockLayerControls = {
    triggerVisibility: vi.fn(),
    triggerEditing: vi.fn(),
    triggerDelete: vi.fn(),
  }

  const mockDisplayedAreas = [
    {
      layerCode: 'main_layer',
      displayNameKey: 'main.layer',
      displayName: 'Main Layer',
      isVisible: true,
      isEditing: false,
      isApiDerived: false,
      parentGroup: 'group1',
      rules: { style: { color: '#ff0000' }, geometricUnit: 'hectare' },
      vectorizedArea: { info: { hectare: { value: 100, formatted: '100 ha' } } },
    },
    {
      layerCode: 'other_layer',
      displayNameKey: 'other.layer',
      displayName: 'Other Layer',
      isVisible: true,
      isEditing: false,
      isApiDerived: false,
      parentGroup: 'group1',
      rules: { style: { color: '#00ff00' }, geometricUnit: 'hectare' },
      vectorizedArea: { info: { hectare: { value: 50, formatted: '50 ha' } } },
    },
    {
      layerCode: 'uneditable_layer',
      displayNameKey: 'uneditable.layer',
      displayName: 'Uneditable Layer',
      isVisible: true,
      isEditing: false,
      isApiDerived: true, // This layer cannot be edited
      parentGroup: 'group1',
      rules: { style: { color: '#0000ff' }, geometricUnit: 'hectare' },
      vectorizedArea: { info: { hectare: { value: 25, formatted: '25 ha' } } },
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should not render if displayedAreas is empty', () => {
    wrapper = mount(AreasDisplayPanel, {
      props: {
        displayedAreas: [],
        layerControls: mockLayerControls,
        currentGroup: 'group1',
      },
    })
    expect(wrapper.find('.areas-panel').exists()).toBe(false)
  })

  it('should render the list of areas', () => {
    wrapper = mount(AreasDisplayPanel, {
      props: {
        displayedAreas: mockDisplayedAreas,
        layerControls: mockLayerControls,
        currentGroup: 'group1',
      },
    })
    expect(wrapper.findAll('li').length).toBe(mockDisplayedAreas.length)
    expect(wrapper.text()).toContain('Main Layer')
    expect(wrapper.text()).toContain('100 ha')
  })

  it('should toggle visibility', async () => {
    wrapper = mount(AreasDisplayPanel, {
      props: {
        displayedAreas: mockDisplayedAreas,
        layerControls: mockLayerControls,
        currentGroup: 'group1',
      },
    })
    const otherLayer = wrapper.findAll('li')[1]
    await otherLayer.find('button').trigger('click')
    expect(mockLayerControls.triggerVisibility).toHaveBeenCalledWith(mockDisplayedAreas[1])
  })

  it('should request edit', async () => {
    wrapper = mount(AreasDisplayPanel, {
      props: {
        displayedAreas: mockDisplayedAreas,
        layerControls: mockLayerControls,
        currentGroup: 'group1',
      },
    })
    const otherLayer = wrapper.findAll('li')[1]
    await otherLayer.findAll('button')[1].trigger('click')
    expect(mockLayerControls.triggerEditing).toHaveBeenCalledWith(mockDisplayedAreas[1])
  })

  it('should not show edit button for API derived layers', () => {
    wrapper = mount(AreasDisplayPanel, {
      props: {
        displayedAreas: mockDisplayedAreas,
        layerControls: mockLayerControls,
        currentGroup: 'group1',
      },
    })
    const uneditableLayer = wrapper.findAll('li')[2]
    expect(
      uneditableLayer
        .findAll('button')
        .filter((b) => b.attributes('title') === 'mapComponents.areasDisplayPanel.editLayer')
        .length,
    ).toBe(0)
  })

  it('should request delete', async () => {
    wrapper = mount(AreasDisplayPanel, {
      props: {
        displayedAreas: mockDisplayedAreas,
        layerControls: mockLayerControls,
        currentGroup: 'group1',
      },
    })
    const otherLayer = wrapper.findAll('li')[1]
    const deleteButton = otherLayer
      .findAll('button')
      .find((b) => b.attributes('title') === 'mapComponents.areasDisplayPanel.removeLayer')
    expect(deleteButton).toBeDefined()
    if (deleteButton) {
      await deleteButton.trigger('click')
      expect(mockLayerControls.triggerDelete).toHaveBeenCalledWith(mockDisplayedAreas[1])
    }
  })

  it('should not show delete button when item does not belong to current group', () => {
    wrapper = mount(AreasDisplayPanel, {
      props: {
        displayedAreas: mockDisplayedAreas,
        layerControls: mockLayerControls,
        currentGroup: 'group2',
      },
    })
    const otherLayer = wrapper.findAll('li')[1]
    const deleteButton = otherLayer
      .findAll('button')
      .find((b) => b.attributes('title') === 'mapComponents.areasDisplayPanel.removeLayer')
    expect(deleteButton).toBeUndefined()
  })

  it('should show edit button even when item does not belong to current group', () => {
    wrapper = mount(AreasDisplayPanel, {
      props: {
        displayedAreas: mockDisplayedAreas,
        layerControls: mockLayerControls,
        currentGroup: 'group2',
      },
    })
    const otherLayer = wrapper.findAll('li')[1]
    const editButton = otherLayer
      .findAll('button')
      .find((b) => b.attributes('title') === 'mapComponents.areasDisplayPanel.editLayer')
    expect(editButton).toBeDefined()
  })

  it('should display N/A when area is not available', () => {
    const areasWithNoVectorized = [
      {
        ...mockDisplayedAreas[0],
        vectorizedArea: null,
      },
    ]
    wrapper = mount(AreasDisplayPanel, {
      props: {
        displayedAreas: areasWithNoVectorized,
        layerControls: mockLayerControls,
        currentGroup: 'group1',
      },
    })
    expect(wrapper.text()).toContain('mapComponents.areasDisplayPanel.notApplicable')
  })
})
