import React from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import Canvas from "./src/scene/Canvas";

// The 3D scene tree mounts ONCE here per CLAUDE.md hard rule 1.
// Never pass changing props down to Canvas; updates flow through the
// Zustand store and useFrame, never through React re-renders.
export default function App() {
  return (
    <View style={styles.container}>
      <Canvas />
      <StatusBar style="light" />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06080F",
  },
});
