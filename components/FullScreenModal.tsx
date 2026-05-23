// components/FullScreenModal.tsx - Reusable Full Screen Modal Component
// Path: NurCakePOS/client/components/FullScreenModal.tsx

import { Ionicons } from "@expo/vector-icons";
import React from "react";
import {
  Dimensions,
  KeyboardAvoidingView,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  TouchableWithoutFeedback,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

const { height: screenHeight } = Dimensions.get("window");

// ============================================
// TYPES
// ============================================

interface FullScreenModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  // Optional props
  showHeader?: boolean;
  scrollable?: boolean;
  footer?: React.ReactNode;
  closeOnBackdrop?: boolean;
  animationType?: "slide" | "fade" | "none";
  // For bottom sheet style
  bottomSheet?: boolean;
  bottomSheetHeight?: number | string;
}

// ============================================
// FULL SCREEN MODAL COMPONENT
// ============================================

export function FullScreenModal({
  visible,
  onClose,
  title,
  children,
  showHeader = true,
  scrollable = true,
  footer,
  closeOnBackdrop = true,
  animationType = "slide",
  bottomSheet = false,
  bottomSheetHeight = "90%",
}: FullScreenModalProps): JSX.Element {
  // Bottom Sheet Style Modal
  if (bottomSheet) {
    return (
      <Modal
        visible={visible}
        transparent={true}
        animationType={animationType}
        onRequestClose={onClose}
        statusBarTranslucent>
        {/* Backdrop */}
        <TouchableWithoutFeedback
          onPress={closeOnBackdrop ? onClose : undefined}>
          <View style={styles.backdrop} />
        </TouchableWithoutFeedback>

        {/* Modal Content */}
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : "height"}
          style={styles.bottomSheetContainer}>
          <View
            style={[
              styles.bottomSheetContent,
              {
                maxHeight:
                  typeof bottomSheetHeight === "number"
                    ? bottomSheetHeight
                    : bottomSheetHeight,
              },
            ]}>
            {/* Handle Bar */}
            <View style={styles.handleBarContainer}>
              <View style={styles.handleBar} />
            </View>

            {/* Header */}
            {showHeader && (
              <View style={styles.header}>
                <Text style={styles.headerTitle}>{title}</Text>
                <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                  <Ionicons name="close" size={24} color="#6B7280" />
                </TouchableOpacity>
              </View>
            )}

            {/* Content */}
            {scrollable ? (
              <ScrollView
                style={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContentContainer}>
                {children}
              </ScrollView>
            ) : (
              <View style={styles.content}>{children}</View>
            )}

            {/* Footer */}
            {footer && <View style={styles.footer}>{footer}</View>}
          </View>
        </KeyboardAvoidingView>
      </Modal>
    );
  }

  // Full Screen Style Modal
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType={animationType}
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <View style={styles.fullScreenBackdrop}>
        <SafeAreaView style={styles.fullScreenContainer}>
          {/* Header */}
          {showHeader && (
            <View style={styles.header}>
              <Text style={styles.headerTitle}>{title}</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <Ionicons name="close" size={24} color="#6B7280" />
              </TouchableOpacity>
            </View>
          )}

          {/* Content */}
          <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            style={styles.keyboardAvoid}>
            {scrollable ? (
              <ScrollView
                style={styles.scrollContent}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.scrollContentContainer}>
                {children}
              </ScrollView>
            ) : (
              <View style={styles.content}>{children}</View>
            )}
          </KeyboardAvoidingView>

          {/* Footer */}
          {footer && <View style={styles.footer}>{footer}</View>}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

// ============================================
// CENTER MODAL COMPONENT (for dialogs)
// ============================================

interface CenterModalProps {
  visible: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  maxWidth?: number;
  closeOnBackdrop?: boolean;
}

export function CenterModal({
  visible,
  onClose,
  title,
  children,
  maxWidth = 400,
  closeOnBackdrop = true,
}: CenterModalProps): JSX.Element {
  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      {/* Backdrop */}
      <TouchableWithoutFeedback onPress={closeOnBackdrop ? onClose : undefined}>
        <View style={styles.centerBackdrop}>
          <TouchableWithoutFeedback>
            <View style={[styles.centerContent, { maxWidth }]}>
              {/* Header */}
              {title && (
                <View style={styles.header}>
                  <Text style={styles.headerTitle}>{title}</Text>
                  <TouchableOpacity
                    onPress={onClose}
                    style={styles.closeButton}>
                    <Ionicons name="close" size={24} color="#6B7280" />
                  </TouchableOpacity>
                </View>
              )}

              {/* Content */}
              <View style={styles.centerModalContent}>{children}</View>
            </View>
          </TouchableWithoutFeedback>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
  );
}

// ============================================
// IMAGE VIEWER MODAL
// ============================================

interface ImageModalProps {
  visible: boolean;
  onClose: () => void;
  imageUri?: string;
  title?: string;
}

export function ImageModal({
  visible,
  onClose,
  imageUri,
  title = "Foto",
}: ImageModalProps): JSX.Element {
  const Image = require("react-native").Image;

  return (
    <Modal
      visible={visible}
      transparent={true}
      animationType="fade"
      onRequestClose={onClose}
      statusBarTranslucent>
      <TouchableOpacity
        activeOpacity={1}
        style={styles.imageModalBackdrop}
        onPress={onClose}>
        <View style={styles.imageModalHeader}>
          <Text style={styles.imageModalTitle}>{title}</Text>
          <TouchableOpacity onPress={onClose} style={styles.imageModalClose}>
            <Ionicons name="close-circle" size={32} color="white" />
          </TouchableOpacity>
        </View>

        {imageUri && (
          <Image
            source={{ uri: imageUri }}
            style={styles.imageModalImage}
            resizeMode="contain"
          />
        )}
      </TouchableOpacity>
    </Modal>
  );
}

// ============================================
// STYLES
// ============================================

const styles = StyleSheet.create({
  // Backdrop
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  fullScreenBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
  },
  centerBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },

  // Full Screen Modal
  fullScreenContainer: {
    flex: 1,
    backgroundColor: "white",
    marginTop: 40, // Safe space from top
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },

  // Bottom Sheet
  bottomSheetContainer: {
    flex: 1,
    justifyContent: "flex-end",
  },
  bottomSheetContent: {
    backgroundColor: "white",
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    overflow: "hidden",
  },
  handleBarContainer: {
    alignItems: "center",
    paddingVertical: 12,
  },
  handleBar: {
    width: 40,
    height: 4,
    backgroundColor: "#D1D5DB",
    borderRadius: 2,
  },

  // Header
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#E5E7EB",
    backgroundColor: "white",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "#111827",
    flex: 1,
  },
  closeButton: {
    padding: 4,
    borderRadius: 20,
    backgroundColor: "#F3F4F6",
  },

  // Content
  keyboardAvoid: {
    flex: 1,
  },
  content: {
    flex: 1,
    padding: 20,
  },
  scrollContent: {
    flex: 1,
  },
  scrollContentContainer: {
    padding: 20,
    paddingBottom: 40,
  },

  // Footer
  footer: {
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: "#E5E7EB",
    backgroundColor: "white",
  },

  // Center Modal
  centerContent: {
    backgroundColor: "white",
    borderRadius: 16,
    width: "100%",
    maxHeight: screenHeight * 0.8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.25,
    shadowRadius: 20,
    elevation: 20,
  },
  centerModalContent: {
    padding: 20,
  },

  // Image Modal
  imageModalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.95)",
    justifyContent: "center",
    alignItems: "center",
  },
  imageModalHeader: {
    position: "absolute",
    top: 50,
    left: 0,
    right: 0,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    zIndex: 10,
  },
  imageModalTitle: {
    fontSize: 18,
    fontWeight: "600",
    color: "white",
  },
  imageModalClose: {
    padding: 4,
  },
  imageModalImage: {
    width: "90%",
    height: "70%",
  },
});

export default FullScreenModal;
