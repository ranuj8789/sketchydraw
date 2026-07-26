import { getUser, isProUser } from "./auth";

export function hasProAccess() {
  try {
    return isProUser(getUser());
  } catch (_) {
    return false;
  }
}

export function requestProUpgrade(feature = "this feature") {
  window.dispatchEvent(
    new CustomEvent("sketchydraw:open-subscription", {
      detail: { feature },
    })
  );
}

export function runProFeature(feature, action) {
  if (!hasProAccess()) {
    requestProUpgrade(feature);
    return false;
  }
  action?.();
  return true;
}
