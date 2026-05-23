// app/index.tsx
import { Ionicons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { router } from "expo-router";
import { useEffect } from "react";
import { StyleSheet, Text, View } from "react-native";

export default function SplashScreen() {
  // useEffect(() => {
  // Redirect to login after 2 seconds
  // const timer = setTimeout(() => {
  //   router.replace("/login");
  // }, 2000);
  useEffect(() => {
    // Redirect to pos after 2 seconds
    const timer = setTimeout(() => {
      router.replace("/pos");
    }, 2000);

    return () => clearTimeout(timer);
  }, []);

  return (
    <LinearGradient
      colors={["#FFF7ED", "#FDF2F8", "#FAF5FF"]}
      style={styles.container}>
      <View style={styles.content}>
        {/* Logo */}
        <View style={styles.logoContainer}>
          <Ionicons name="cafe" size={60} color="#EA580C" />
        </View>

        {/* Welcome Text */}
        <View style={styles.textContainer}>
          <Text style={styles.welcomeText}>Selamat Datang di</Text>
          <Text style={styles.brandText}>NurCake POS</Text>
          <Text style={styles.descriptionText}>
            Sistem Point of Sales yang mudah dan efisien untuk toko kue dan
            bakery Anda
          </Text>
        </View>

        {/* Loading */}
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Memuat aplikasi...</Text>
          <Text style={styles.redirectText}>
            Anda akan diarahkan ke halaman pos dalam beberapa detik
          </Text>
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text style={styles.footerText}>© Maizan Insani Akbar.</Text>
        </View>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  content: {
    alignItems: "center",
    flex: 1,
    justifyContent: "center",
  },
  logoContainer: {
    width: 120,
    height: 120,
    backgroundColor: "#FED7AA",
    borderRadius: 60,
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 40,
  },
  textContainer: {
    alignItems: "center",
    marginBottom: 60,
  },
  welcomeText: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#111827",
    marginBottom: 8,
    textAlign: "center",
  },
  brandText: {
    fontSize: 40,
    fontWeight: "900",
    color: "#EA580C",
    marginBottom: 16,
    textAlign: "center",
  },
  descriptionText: {
    fontSize: 16,
    color: "#6B7280",
    textAlign: "center",
    maxWidth: 300,
    lineHeight: 24,
  },
  loadingContainer: {
    alignItems: "center",
    marginBottom: 80,
  },
  loadingText: {
    fontSize: 14,
    fontWeight: "500",
    color: "#6B7280",
    marginBottom: 8,
  },
  redirectText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
  footer: {
    position: "absolute",
    bottom: 40,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
  },
  footerText: {
    fontSize: 12,
    color: "#9CA3AF",
    textAlign: "center",
  },
});
