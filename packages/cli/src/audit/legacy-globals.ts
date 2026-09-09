/**
 * The bare globals v13 turned into aliases of a `foundry.*` path.
 *
 * Each still resolves on v14 with a deprecation warning, and none resolves
 * on v15. The namespaced path is the same object, so a rewrite from one to
 * the other changes nothing at runtime and removes a removal date. The list
 * is the part of the public API a system or module is likely to reach for
 * bare; the canvas shaders and the rest are left out on purpose.
 *
 * `Application`, `FormApplication`, `Dialog` and `DocumentSheet` are not
 * here: those are plain aliases with no warning, and the whole v1 framework
 * goes in v16, which `VTTF-AUDIT-018` reports.
 */
export const LEGACY_GLOBALS: Readonly<Record<string, string>> = Object.freeze({
  // Handlebars
  renderTemplate: 'foundry.applications.handlebars.renderTemplate',
  loadTemplates: 'foundry.applications.handlebars.loadTemplates',
  getTemplate: 'foundry.applications.handlebars.getTemplate',
  // Application v1 sheets
  ActorSheet: 'foundry.appv1.sheets.ActorSheet',
  ItemSheet: 'foundry.appv1.sheets.ItemSheet',
  JournalSheet: 'foundry.appv1.sheets.JournalSheet',
  JournalPageSheet: 'foundry.appv1.sheets.JournalPageSheet',
  JournalTextPageSheet: 'foundry.appv1.sheets.JournalTextPageSheet',
  // UX helpers
  TextEditor: 'foundry.applications.ux.TextEditor.implementation',
  ContextMenu: 'foundry.applications.ux.ContextMenu.implementation',
  DragDrop: 'foundry.applications.ux.DragDrop.implementation',
  Draggable: 'foundry.applications.ux.Draggable.implementation',
  FormDataExtended: 'foundry.applications.ux.FormDataExtended',
  SearchFilter: 'foundry.applications.ux.SearchFilter',
  Tabs: 'foundry.applications.ux.Tabs',
  ProseMirrorEditor: 'foundry.applications.ux.ProseMirrorEditor',
  FilePicker: 'foundry.applications.apps.FilePicker.implementation',
  ImagePopout: 'foundry.applications.apps.ImagePopout',
  DocumentSheetConfig: 'foundry.applications.apps.DocumentSheetConfig',
  // Sheets and configs
  ActiveEffectConfig: 'foundry.applications.sheets.ActiveEffectConfig',
  TokenConfig: 'foundry.applications.sheets.TokenConfig',
  SceneConfig: 'foundry.applications.sheets.SceneConfig',
  MacroConfig: 'foundry.applications.sheets.MacroConfig',
  SettingsConfig: 'foundry.applications.settings.SettingsConfig',
  // Sidebar and UI
  Sidebar: 'foundry.applications.sidebar.Sidebar',
  ChatLog: 'foundry.applications.sidebar.tabs.ChatLog',
  CombatTracker: 'foundry.applications.sidebar.tabs.CombatTracker',
  ActorDirectory: 'foundry.applications.sidebar.tabs.ActorDirectory',
  ItemDirectory: 'foundry.applications.sidebar.tabs.ItemDirectory',
  JournalDirectory: 'foundry.applications.sidebar.tabs.JournalDirectory',
  CompendiumDirectory: 'foundry.applications.sidebar.tabs.CompendiumDirectory',
  Compendium: 'foundry.applications.sidebar.apps.Compendium',
  ModuleManagement: 'foundry.applications.sidebar.apps.ModuleManagement',
  Hotbar: 'foundry.applications.ui.Hotbar',
  SceneControls: 'foundry.applications.ui.SceneControls',
  SceneNavigation: 'foundry.applications.ui.SceneNavigation',
  Players: 'foundry.applications.ui.Players',
  Notifications: 'foundry.applications.ui.Notifications',
  TokenHUD: 'foundry.applications.hud.TokenHUD',
  // Collections
  Actors: 'foundry.documents.collections.Actors',
  Items: 'foundry.documents.collections.Items',
  Journal: 'foundry.documents.collections.Journal',
  Macros: 'foundry.documents.collections.Macros',
  Messages: 'foundry.documents.collections.ChatMessages',
  Playlists: 'foundry.documents.collections.Playlists',
  RollTables: 'foundry.documents.collections.RollTables',
  Scenes: 'foundry.documents.collections.Scenes',
  Users: 'foundry.documents.collections.Users',
  Folders: 'foundry.documents.collections.Folders',
  CompendiumCollection: 'foundry.documents.collections.CompendiumCollection',
  CompendiumPacks: 'foundry.documents.collections.CompendiumPacks',
  WorldCollection: 'foundry.documents.abstract.WorldCollection',
  DocumentCollection: 'foundry.documents.abstract.DocumentCollection',
  // Canvas
  Canvas: 'foundry.canvas.Canvas',
  CanvasLayer: 'foundry.canvas.layers.CanvasLayer',
  InteractionLayer: 'foundry.canvas.layers.InteractionLayer',
  PlaceablesLayer: 'foundry.canvas.layers.PlaceablesLayer',
  PlaceableObject: 'foundry.canvas.placeables.PlaceableObject',
  Token: 'foundry.canvas.placeables.Token',
  Tile: 'foundry.canvas.placeables.Tile',
  Drawing: 'foundry.canvas.placeables.Drawing',
  Note: 'foundry.canvas.placeables.Note',
  Wall: 'foundry.canvas.placeables.Wall',
  Region: 'foundry.canvas.placeables.Region',
  AmbientLight: 'foundry.canvas.placeables.AmbientLight',
  AmbientSound: 'foundry.canvas.placeables.AmbientSound',
  Ray: 'foundry.canvas.geometry.Ray',
  ClockwiseSweepPolygon: 'foundry.canvas.geometry.ClockwiseSweepPolygon',
  CanvasAnimation: 'foundry.canvas.animation.CanvasAnimation',
  ChatBubbles: 'foundry.canvas.animation.ChatBubbles',
  MouseInteractionManager: 'foundry.canvas.interaction.MouseInteractionManager',
  Ruler: 'foundry.canvas.interaction.Ruler',
  TextureLoader: 'foundry.canvas.TextureLoader',
  getTexture: 'foundry.canvas.getTexture',
  loadTexture: 'foundry.canvas.loadTexture',
  srcExists: 'foundry.canvas.srcExists',
  // Helpers
  ClientSettings: 'foundry.helpers.ClientSettings',
  ClientKeybindings: 'foundry.helpers.interaction.ClientKeybindings',
  GameTime: 'foundry.helpers.GameTime',
  Localization: 'foundry.helpers.Localization',
  SocketInterface: 'foundry.helpers.SocketInterface',
  TooltipManager: 'foundry.helpers.interaction.TooltipManager.implementation',
  VideoHelper: 'foundry.helpers.media.VideoHelper',
  ImageHelper: 'foundry.helpers.media.ImageHelper',
  AsyncWorker: 'foundry.helpers.AsyncWorker',
  SortingHelpers: 'foundry.utils.SortingHelpers',
  saveDataToFile: 'foundry.utils.saveDataToFile',
  readTextFromFile: 'foundry.utils.readTextFromFile',
  // Packages and tours
  Module: 'foundry.packages.Module',
  System: 'foundry.packages.System',
  World: 'foundry.packages.World',
  Tour: 'foundry.nue.Tour',
  Tours: 'foundry.nue.ToursCollection',
});

/**
 * Does the file declare or import the name itself?
 *
 * A module that defines its own `Token` class or imports `Tabs` from a
 * library is using that, not Foundry's global.
 */
export function definesName(source: string, name: string): boolean {
  return new RegExp(
    `(?:\\b(?:class|function|const|let|var)\\s+${name}\\b|import[^;]*\\b${name}\\b|\\b${name}\\s*\\([^)]*\\)\\s*\\{)`,
  ).test(source);
}

/**
 * A bare use of `name`: not a property (`x.Token`), not an object key
 * (`{ Token: 1 }`), not part of a longer identifier.
 */
export function bareUsePattern(name: string): RegExp {
  return new RegExp(`(?<![\\w$.])${name}\\b(?!\\s*:(?!:))(?=[\\s.(,;)\\]}]|$)`, 'gm');
}
