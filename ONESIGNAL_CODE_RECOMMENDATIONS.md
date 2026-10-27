# OneSignal Recommendations — Review and Implementation

Reviewed against the current OneSignal Web SDK v16 documentation and the installed `react-onesignal` 3.5.6 API.

## Implemented

- Development builds log permission and push-subscription state changes. Subscription identifiers and user IDs are not logged.
- Initialization, login, logout, and permission-request failures are logged rather than silently swallowed.

## Deliberately Not Implemented

- **Custom notification routing:** The backend sends the destination using OneSignal's top-level `url` field, which OneSignal uses as the notification click URL. The SDK's default click handling is sufficient; no custom listener or `notificationClickHandlerMatch` override is needed.
- **Permission callbacks/options:** `Notifications.requestPermission()` takes no options. Prompt customization belongs in OneSignal `init` under `promptOptions`; a soft prompt is shown separately with `OneSignal.Slidedown.promptPush()`. The checkout flow's existing direct browser permission request is retained to avoid changing its UX.
- **Custom login retries:** The Web SDK retries login on network/server failures. The proposed recursive retry can wait on the `loginPromise` it is itself awaiting, causing a deadlock.
- **Initialization timeout:** Racing `init()` against a timeout does not cancel SDK initialization and can leave a late initialization running while the cached promise reports failure. Checkout already bounds how long it waits for permission.
- **Configuration validator:** Requiring a manifest and validating an App ID with a fixed format would introduce assumptions that do not establish whether the OneSignal app is correctly configured in the dashboard.
- **Analytics integration:** The project has no analytics client wired into this flow. Adding placeholder `console.log` calls would not provide analytics.
- **Test helpers:** The suggested simulation and permission-mocking helpers do not actually simulate SDK or browser behavior. They should be replaced with tests using a configured test runner if OneSignal unit tests are added.

## Current Permission Flow

`requestPushPermission()` calls the documented no-argument `OneSignal.Notifications.requestPermission()` method. OneSignal prompt text/options should be configured through `promptOptions` during initialization only if the product adopts a soft-prompt flow.

## Backend Click URL Contract

The notification API call sets `url: \`${frontendUrl}${url}\``. OneSignal uses that URL when the notification is clicked; the app does not need to translate the database `Notification.url` through a browser click listener. Ensure `url` is a relative path on the frontend origin before concatenating it with `frontendUrl`, and avoid sending arbitrary user-controlled absolute URLs.

## References

- [OneSignal Web SDK setup](https://documentation.onesignal.com/docs/en/web-sdk-setup)
- [OneSignal Web SDK reference](https://documentation.onesignal.com/docs/en/web-sdk-reference)
- [OneSignal React/Next.js setup](https://documentation.onesignal.com/docs/en/react-js-setup)
- [react-onesignal package documentation](https://github.com/OneSignal/onesignal-react)
