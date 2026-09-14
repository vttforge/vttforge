// The reload handlers touch `document` directly (that is the whole job of
// the CSS path), so every test in this package needs a DOM.
import { GlobalRegistrator } from '@happy-dom/global-registrator';

GlobalRegistrator.register();
