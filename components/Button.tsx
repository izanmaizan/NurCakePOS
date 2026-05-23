// components/Button.tsx
import { Ionicons } from "@expo/vector-icons";
import {
  ActivityIndicator,
  Text,
  TextStyle,
  TouchableOpacity,
  ViewStyle,
} from "react-native";
import { Colors } from "../constants/Colors";

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: "primary" | "secondary" | "outline" | "danger";
  size?: "small" | "medium" | "large";
  disabled?: boolean;
  loading?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export default function Button({
  title,
  onPress,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  icon,
  style,
  textStyle,
}: ButtonProps) {
  const getButtonStyle = (): ViewStyle => {
    const baseStyle: ViewStyle = {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "center",
      borderRadius: 8,
    };

    // Size styles
    switch (size) {
      case "small":
        baseStyle.paddingVertical = 8;
        baseStyle.paddingHorizontal = 12;
        break;
      case "large":
        baseStyle.paddingVertical = 16;
        baseStyle.paddingHorizontal = 24;
        break;
      default:
        baseStyle.paddingVertical = 12;
        baseStyle.paddingHorizontal = 16;
        break;
    }

    // Variant styles
    switch (variant) {
      case "secondary":
        baseStyle.backgroundColor = Colors.light.secondary;
        break;
      case "outline":
        baseStyle.backgroundColor = "transparent";
        baseStyle.borderWidth = 1;
        baseStyle.borderColor = Colors.light.border;
        break;
      case "danger":
        baseStyle.backgroundColor = Colors.light.error;
        break;
      default:
        baseStyle.backgroundColor = Colors.light.primary;
        break;
    }

    // Disabled style
    if (disabled || loading) {
      baseStyle.opacity = 0.5;
    }

    return baseStyle;
  };

  const getTextStyle = (): TextStyle => {
    const baseStyle: TextStyle = {
      fontWeight: "600",
    };

    // Size styles
    switch (size) {
      case "small":
        baseStyle.fontSize = 14;
        break;
      case "large":
        baseStyle.fontSize = 18;
        break;
      default:
        baseStyle.fontSize = 16;
        break;
    }

    // Variant styles
    switch (variant) {
      case "outline":
        baseStyle.color = Colors.light.text;
        break;
      default:
        baseStyle.color = "white";
        break;
    }

    return baseStyle;
  };

  return (
    <TouchableOpacity
      style={[getButtonStyle(), style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}>
      {loading ? (
        <ActivityIndicator
          size="small"
          color={variant === "outline" ? Colors.light.primary : "white"}
        />
      ) : (
        <>
          {icon && (
            <Ionicons
              name={icon}
              size={size === "large" ? 20 : 16}
              color={variant === "outline" ? Colors.light.text : "white"}
              style={{ marginRight: 8 }}
            />
          )}
          <Text style={[getTextStyle(), textStyle]}>{title}</Text>
        </>
      )}
    </TouchableOpacity>
  );
}
