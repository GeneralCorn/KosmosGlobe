import React from "react";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, View } from "react-native";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Canvas from "./src/scene/Canvas";
import { useSyncStoreFromQueries } from "./src/api/queries";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
});

function DataBootstrap() {
  useSyncStoreFromQueries();
  return null;
}

// The 3D scene tree mounts ONCE here per CLAUDE.md hard rule 1.
// Never pass changing props down to Canvas; updates flow through the
// Zustand store and useFrame, never through React re-renders.
export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <View style={styles.container}>
        <Canvas />
        <DataBootstrap />
        <StatusBar style="light" />
      </View>
    </QueryClientProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#06080F",
  },
});
