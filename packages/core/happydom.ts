// Registers happy-dom's globals (document, window, ...) before any test
// file runs. Only 9 of this package's 26 test files actually touch the DOM
// (the ApplicationV2/sheet base classes), but the other 17 were audited by
// hand and none reference document/window at runtime, so registering
// globally is safe and simpler than per-file scoping.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
