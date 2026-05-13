import { Text, TextProps, StyleSheet } from 'react-native';
import { useTheme } from '~/hooks/useTheme';
import { FONT_FAMILY, FONT_SIZE, FONT_WEIGHT } from '~/constants/Fonts';

type Variant =
  | 'display'
  | 'hero'
  | 'headingLg'
  | 'heading'
  | 'title'
  | 'subheading'
  | 'bodyLg'
  | 'body'
  | 'label'
  | 'caption'
  | 'sm'
  | 'xs';

interface AppTextProps extends TextProps {
  variant?: Variant;
  color?: string;
  weight?: keyof typeof FONT_WEIGHT;
  center?: boolean;
}

export function AppText({
  variant = 'body',
  color,
  weight,
  center,
  style,
  children,
  ...rest
}: AppTextProps) {
  const { colors } = useTheme();

  const fontFamily =
    weight === 'extraBold' || weight === 'bold'
      ? FONT_FAMILY.bold
      : weight === 'semiBold'
        ? FONT_FAMILY.semiBold
        : weight === 'medium'
          ? FONT_FAMILY.medium
          : FONT_FAMILY.regular;

  return (
    <Text
      style={[
        {
          color: color ?? colors.text,
          fontSize: FONT_SIZE[variant],
          fontFamily,
        },
        center && styles.center,
        style,
      ]}
      {...rest}
    >
      {children}
    </Text>
  );
}

const styles = StyleSheet.create({
  center: { textAlign: 'center' },
});
