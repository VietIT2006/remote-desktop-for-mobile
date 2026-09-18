import React, { useState } from 'react';
import { StyleSheet, TextInput, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { Spacing } from '@/constants/theme';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'expo-router';

export default function HomeScreen() {
  const [pinCode, setPinCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleConnect = async () => {
    if (pinCode.length !== 6) {
      Alert.alert('Lỗi', 'Mã PIN phải bao gồm 6 chữ số');
      return;
    }

    setIsLoading(true);
    try {
      // Query Supabase to find the session with this PIN
      // Note: We assume you have a 'sessions' table created in Supabase
      const { data, error } = await supabase
        .from('sessions')
        .select('desktop_ip, status')
        .eq('pin_code', pinCode)
        .single();

      if (error || !data) {
        Alert.alert('Lỗi', 'Không tìm thấy máy tính nào với mã PIN này, hoặc mã đã hết hạn.');
        return;
      }

      if (data.status !== 'waiting') {
        Alert.alert('Lỗi', 'Máy tính này hiện không sẵn sàng kết nối.');
        return;
      }

      // Success, navigate to the remote control screen with the IP
      router.push({
        pathname: '/remote',
        params: { ip: data.desktop_ip, pin: pinCode }
      });
      
    } catch (err) {
      console.error(err);
      Alert.alert('Lỗi kết nối', 'Không thể kết nối đến máy chủ trung gian.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.content}>
          <ThemedText type="title" style={styles.title}>
            Remote Desktop
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Nhập mã PIN gồm 6 số hiển thị trên phần mềm Desktop của máy tính.
          </ThemedText>

          <TextInput
            style={styles.pinInput}
            value={pinCode}
            onChangeText={(text) => setPinCode(text.replace(/[^0-9]/g, '').slice(0, 6))}
            keyboardType="number-pad"
            placeholder="000000"
            placeholderTextColor="#666"
            maxLength={6}
            editable={!isLoading}
          />

          <TouchableOpacity 
            style={[styles.button, (pinCode.length < 6 || isLoading) && styles.buttonDisabled]} 
            onPress={handleConnect}
            disabled={pinCode.length < 6 || isLoading}
          >
            {isLoading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <ThemedText style={styles.buttonText}>Kết Nối</ThemedText>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  safeArea: {
    flex: 1,
    paddingHorizontal: Spacing.four,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.four,
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    marginBottom: Spacing.two,
    color: '#FFFFFF',
  },
  subtitle: {
    textAlign: 'center',
    marginBottom: Spacing.four,
    opacity: 0.8,
    color: '#CCCCCC',
  },
  pinInput: {
    width: '100%',
    height: 80,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    borderRadius: Spacing.three,
    fontSize: 48,
    fontWeight: 'bold',
    textAlign: 'center',
    letterSpacing: 8,
    color: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
  },
  button: {
    width: '100%',
    height: 56,
    backgroundColor: '#007AFF',
    borderRadius: Spacing.three,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: Spacing.two,
  },
  buttonDisabled: {
    backgroundColor: 'rgba(0, 122, 255, 0.5)',
  },
  buttonText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: 'bold',
  },
});
