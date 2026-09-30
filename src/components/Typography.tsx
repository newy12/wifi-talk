import { forwardRef } from 'react';
import {
  StyleSheet,
  Text as RNText,
  TextInput as RNTextInput,
  type TextInputProps,
  type TextProps,
} from 'react-native';
import { fonts } from '@/lib/theme';

/**
 * 기본 글꼴(fonts.ui)을 입힌 Text / TextInput.
 * react-native 대신 여기서 import 한다. style 에 fontFamily 를 주면 그게 우선한다.
 */
export function Text({ style, ...rest }: TextProps) {
  return <RNText style={[base.ui, style]} {...rest} />;
}

export const TextInput = forwardRef<RNTextInput, TextInputProps>(function TextInput({ style, ...rest }, ref) {
  return <RNTextInput ref={ref} style={[base.ui, style]} {...rest} />;
});

const base = StyleSheet.create({
  ui: { fontFamily: fonts?.ui },
});
