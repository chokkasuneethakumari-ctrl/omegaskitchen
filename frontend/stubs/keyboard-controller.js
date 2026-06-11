// Expo Go can't load `react-native-keyboard-controller` (a custom native module
// not bundled in the Expo Go runtime). This stub re-implements the few exports
// the app uses on top of React Native's built-ins so the app runs in Expo Go.
// It is wired up ONLY when Metro is started with EXPO_GO=1 (see metro.config.js).
// For a real development/production build, the real native module is used and
// this file is ignored — so the premium keyboard behavior is preserved there.
import React from "react";
import { KeyboardAvoidingView as RNKeyboardAvoidingView, ScrollView } from "react-native";

export const KeyboardProvider = ({ children }) => children;

// react-native-keyboard-controller's KeyboardAwareScrollView adds props that
// RN's ScrollView doesn't understand — strip them so they don't reach the DOM/view.
export const KeyboardAwareScrollView = React.forwardRef(function KeyboardAwareScrollView(
  { bottomOffset, disableScrollOnKeyboardHide, enabled, extraKeyboardSpace, ScrollViewComponent, ...rest },
  ref,
) {
  const Comp = ScrollViewComponent || ScrollView;
  return <Comp ref={ref} keyboardShouldPersistTaps="handled" {...rest} />;
});

// Map to RN's own KeyboardAvoidingView; drop kc-only props.
export const KeyboardAvoidingView = React.forwardRef(function KeyboardAvoidingView(
  { enabled = true, ...rest },
  ref,
) {
  return <RNKeyboardAvoidingView ref={ref} enabled={enabled} {...rest} />;
});

export const KeyboardStickyView = ({ children }) => children;
export const KeyboardGestureArea = ({ children }) => children;

export const KeyboardController = {
  dismiss: () => {},
  setInputMode: () => {},
  setDefaultMode: () => {},
  setFocusTo: () => {},
};

export const useKeyboardController = () => ({ enabled: true, setEnabled: () => {} });
export const useReanimatedKeyboardAnimation = () => ({
  height: { value: 0 },
  progress: { value: 0 },
});
export const useKeyboardHandler = () => {};

export default {
  KeyboardProvider,
  KeyboardAwareScrollView,
  KeyboardAvoidingView,
  KeyboardStickyView,
  KeyboardController,
};
