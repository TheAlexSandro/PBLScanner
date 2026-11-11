import { DarkTheme, NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { StatusBar } from "expo-status-bar";
import { StyleSheet, Text, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { AppGate } from "./src/components/AppGate";
import { Config } from "./src/config";
import type { RootStackParamList } from "./src/navigation";
import HomeScreen from "./src/screens/HomeScreen";
import ScannerScreen from "./src/screens/ScannerScreen";
import SplashScreen from "./src/screens/SplashScreen";
import { connectivity } from "./src/services/connectivity";
import { scannerStatus } from "./src/services/scannerStatus";
import { versionService } from "./src/services/version";
import { homeIconService } from "./src/services/homeIcon";
import { AppTheme } from "./src/theme";
import { ObserveRoot } from "expo-observe";

if (Config.isValid) {
  connectivity.start();
  scannerStatus.start();
  versionService.start();
  homeIconService.start();
}

const Stack = createNativeStackNavigator<RootStackParamList>();

const navTheme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: AppTheme.bg,
    card: AppTheme.bg,
    primary: AppTheme.primary,
  },
};

function App() {
  if (!Config.isValid) {
    return (
      <View style={styles.error}>
        <StatusBar style="light" />
        <Text style={styles.errorText}>Error</Text>
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AppGate>
        <NavigationContainer theme={navTheme}>
          <Stack.Navigator
            initialRouteName="Splash"
            screenOptions={{
              headerShown: false,
              animation: "fade",
              contentStyle: { backgroundColor: AppTheme.bg },
            }}
          >
            <Stack.Screen name="Splash" component={SplashScreen} />
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="Scanner"
              component={ScannerScreen}
              options={{ animation: "slide_from_right" }}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </AppGate>
    </SafeAreaProvider>
  );
}

export default ObserveRoot.wrap(App);
const styles = StyleSheet.create({
  error: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: AppTheme.bg,
    padding: 32,
  },
  errorText: { color: AppTheme.text, textAlign: "center" },
});
