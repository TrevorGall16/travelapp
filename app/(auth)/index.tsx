// Required installs (if not yet installed):
// npx expo install expo-apple-authentication expo-web-browser lucide-react-native

import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import * as AppleAuthentication from 'expo-apple-authentication';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '../../lib/supabase';

// Deep-link scheme configured in app.json → expo.scheme
const REDIRECT_URL = 'nomadmeet://auth/callback';

export default function LoginScreen() {
  const [isSubmittingApple, setIsSubmittingApple] = useState(false);
  const [isSubmittingGoogle, setIsSubmittingGoogle] = useState(false);

  const isLoading = isSubmittingApple || isSubmittingGoogle;

  // ── Apple Sign In ─────────────────────────────────────────────────────────
  const handleAppleSignIn = async () => {
    if (isLoading) return;
    setIsSubmittingApple(true);

    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
        ],
      });

      if (!credential.identityToken) throw new Error('No identity token returned');

      const { error } = await supabase.auth.signInWithIdToken({
        provider: 'apple',
        token: credential.identityToken,
      });

      if (error) throw error;
      // Navigation handled by the root layout auth guard
    } catch (err: unknown) {
      // ERR_REQUEST_CANCELED = user tapped "Cancel" — not a real error
      if (err instanceof Error && err.message !== 'ERR_REQUEST_CANCELED') {
        console.error('[Auth] - LoginScreen - Apple sign-in failed:', err.message);
        Alert.alert('Sign In Failed', 'Something went wrong. Please try again.');
      }
    } finally {
      setIsSubmittingApple(false);
    }
  };

  // ── Google Sign In (PKCE via WebBrowser) ─────────────────────────────────
  const handleGoogleSignIn = async () => {
    if (isLoading) return;
    setIsSubmittingGoogle(true);

    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: REDIRECT_URL,
          skipBrowserRedirect: true,
        },
      });

      if (error || !data.url) throw error ?? new Error('No OAuth URL returned');

      const result = await WebBrowser.openAuthSessionAsync(data.url, REDIRECT_URL);

      if (result.type === 'success' && result.url) {
        const { error: sessionError } = await supabase.auth.exchangeCodeForSession(result.url);
        if (sessionError) throw sessionError;
        // Navigation handled by the root layout auth guard
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      console.error('[Auth] - LoginScreen - Google sign-in failed:', message);
      Alert.alert('Sign In Failed', 'Something went wrong. Please try again.');
    } finally {
      setIsSubmittingGoogle(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <View style={styles.hero}>
        <Text style={styles.logo}>NomadMeet</Text>
        <Text style={styles.tagline}>Meet travelers, not tourists</Text>
      </View>

      {/* ── Sign-In Buttons ──────────────────────────────────────────────── */}
      <View style={styles.buttonsContainer}>
        {/* Apple Sign In — iOS only, required to use Apple's native button */}
        {Platform.OS === 'ios' && (
          <View
            style={{ opacity: isSubmittingApple ? 0.6 : 1 }}
            // Prevent double-tap while a sign-in is in progress
            pointerEvents={isLoading ? 'none' : 'auto'}
          >
            <AppleAuthentication.AppleAuthenticationButton
              buttonType={AppleAuthentication.AppleAuthenticationButtonType.SIGN_IN}
              buttonStyle={AppleAuthentication.AppleAuthenticationButtonStyle.WHITE}
              cornerRadius={12}
              style={styles.appleButton}
              onPress={handleAppleSignIn}
            />
          </View>
        )}

        {/* Google Sign In */}
        <TouchableOpacity
          style={[styles.googleButton, isLoading && styles.buttonDisabled]}
          onPress={handleGoogleSignIn}
          disabled={isLoading}
          activeOpacity={0.8}
        >
          {isSubmittingGoogle ? (
            <ActivityIndicator color="#1F2937" size="small" />
          ) : (
            <>
              <Text style={styles.googleLetter}>G</Text>
              <Text style={styles.googleButtonText}>Continue with Google</Text>
            </>
          )}
        </TouchableOpacity>

        <Text style={styles.legalText}>
          By continuing, you agree to our{' '}
          <Text style={styles.legalLink}>Terms of Service</Text>
          {' '}and{' '}
          <Text style={styles.legalLink}>Privacy Policy</Text>.
        </Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 80,
    paddingBottom: 52,
  },
  hero: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
  },
  logo: {
    fontSize: 42,
    fontWeight: '700',
    color: '#3B82F6',
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 18,
    color: '#94A3B8',
    textAlign: 'center',
  },
  buttonsContainer: {
    gap: 12,
  },
  appleButton: {
    height: 56,
    width: '100%',
  },
  googleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    height: 56,
    gap: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#CBD5E1',
  },
  googleLetter: {
    fontSize: 20,
    fontWeight: '700',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1F2937',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  legalText: {
    fontSize: 12,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginTop: 4,
  },
  legalLink: {
    color: '#3B82F6',
  },
});
