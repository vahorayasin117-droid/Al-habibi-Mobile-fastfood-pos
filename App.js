import React, { useState, useEffect } from 'react';
import {
  StyleSheet,
  View,
  StatusBar as RNStatusBar,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as ScreenOrientation from 'expo-screen-orientation';
import { DataProvider } from './src/context/DataContext';
import POSScreen from './src/screens/POSScreen';
import SetupScreen from './src/screens/SetupScreen';
import DashboardScreen from './src/screens/DashboardScreen';
import SummaryScreen from './src/screens/SummaryScreen';
import { COLORS } from './src/theme';

export default function App() {
  const [screen, setScreen] = useState('pos'); // 'pos' | 'dashboard' | 'setup' | 'summary'
  const [setupInitialTab, setSetupInitialTab] = useState(null);

  // Lock orientation based on active screen
  useEffect(() => {
    RNStatusBar.setHidden(true, 'fade');
    async function configureOrientation() {
      try {
        if (screen === 'pos') {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);
        } else {
          await ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT);
        }
      } catch (err) {
        console.warn('Orientation lock error:', err);
      }
    }
    configureOrientation();
  }, [screen]);

  const goToDashboard = () => setScreen('dashboard');
  const goToSummary = () => setScreen('summary');
  const goToPOS = () => setScreen('pos');

  const goToSetup = (initialTab) => {
    setSetupInitialTab(initialTab || null);
    setScreen('setup');
  };

  const backFromSetup = () => {
    setSetupInitialTab(null);
    setScreen('pos');
  };

  return (
    <DataProvider>
      <View style={styles.container}>
        <StatusBar hidden={true} />

        {screen === 'pos' && (
          <POSScreen
            onOpenSetup={goToSetup}
            onOpenDashboard={goToDashboard}
            onOpenSummary={goToSummary}
          />
        )}

        {screen === 'summary' && (
          <SummaryScreen
            onBack={goToPOS}
            onOpenDashboard={goToDashboard}
            onOpenSetup={goToSetup}
          />
        )}

        {screen === 'dashboard' && (
          <DashboardScreen
            onBack={goToPOS}
            onOpenSummary={goToSummary}
          />
        )}

        {screen === 'setup' && (
          <SetupScreen onBack={backFromSetup} initialTab={setupInitialTab} />
        )}
      </View>
    </DataProvider>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.bg,
  },
});
