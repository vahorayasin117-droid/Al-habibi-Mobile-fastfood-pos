# FastFood POS — Setup

## 1. Create a New Expo Project (Compatible with latest Expo Go)

```bash
npx create-expo-app@latest fastfood-pos
cd fastfood-pos
```

## 2. Install Required Packages

```bash
npx expo install @react-native-async-storage/async-storage expo-print expo-sharing
```

## 3. Copy Files

Copy and replace `App.js`, `app.json`, `assets/`, and the `src/` folder from this directory into your project.

## 4. Run the Project

```bash
npx expo start
```

Scan the QR code using the Expo Go app (ensure the tablet/phone and computer are connected to the same WiFi network).

## Structure

```
App.js
app.json
src/
  theme.js                 — colors
  context/DataContext.js   — categories/products/tags/cart + AsyncStorage
  utils/print.js           — bill print (expo-print)
  utils/storage.js
  utils/id.js
  screens/POSScreen.js     — billing screen (categories + cart)
  screens/SetupScreen.js   — categories/products/tags/shop-name management
  screens/DashboardScreen.js — sales analytics & order history
  components/OrderModal.js — product > variant > add-on flow
  components/CartPanel.js
  components/setup/*
```

## Data

Everything (categories, products, variants, add-on tags, shop settings) is saved in the device's
AsyncStorage — nothing is hardcoded. The shop owner can add, edit, or delete items directly from the Setup screen.

## Printing & Bluetooth Thermal Printer Setup

The app now supports **Direct Bluetooth Thermal Printing (Instant — No Preview Dialog)** using `react-native-thermal-printer-driver`.

### 1. How Direct Print Works (Zero Preview)
- In the other apps in the market, the app sends raw ESC/POS commands directly to the paired Bluetooth thermal printer over an RFCOMM socket.
- When the user taps **Print Bill**, the receipt prints instantly in ~0.1 seconds without opening Android's system print dialog.

### 2. Printer Setup in App
1. Go to your Android phone's **Settings > Bluetooth**, turn on Bluetooth, and pair your thermal printer (default PIN is usually `0000` or `1234`).
2. In the FastFood POS app, open **Settings > Printer & Receipt Settings**.
3. Tap **"Scan Bluetooth Printers"**.
4. Tap **"Connect"** on your printer (e.g. `POS-58`, `MPT-II`, `RPP02N`).
5. Tap **"Test Print Slip"** to test.
6. Now, whenever you tap **Print Bill** on the POS billing screen, it prints immediately without any preview!

### 3. Build APK with Native Bluetooth Support
To build the updated APK with native Bluetooth permissions:
```bash
eas build -p android --profile preview
```
Download the resulting `.apk` and install it on your Android phone.
