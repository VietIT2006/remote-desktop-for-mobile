import React, { useEffect, useState, useRef } from 'react';
import { StyleSheet, View, TouchableOpacity, Text, Image, PanResponder } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import * as ScreenOrientation from 'expo-screen-orientation';

export default function RemoteScreen() {
  const { ip, pin } = useLocalSearchParams();
  const router = useRouter();
  const [frame, setFrame] = useState<string | null>(null);
  const [status, setStatus] = useState('Đang kết nối...');
  const ws = useRef<WebSocket | null>(null);
  
  // Lưu tọa độ cũ để tính khoảng cách (delta) di chuyển
  const lastPan = useRef({ x: 0, y: 0 });

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt, gestureState) => {
        // Khi mới chạm ngón tay vào màn hình
        lastPan.current = { x: gestureState.x0, y: gestureState.y0 };
      },
      onPanResponderMove: (evt, gestureState) => {
        // Khi ngón tay di chuyển
        const dx = gestureState.moveX - lastPan.current.x;
        const dy = gestureState.moveY - lastPan.current.y;
        
        lastPan.current = { x: gestureState.moveX, y: gestureState.moveY };

        if (ws.current && ws.current.readyState === WebSocket.OPEN) {
          ws.current.send(JSON.stringify({ type: 'mousemove', dx, dy }));
        }
      },
      onPanResponderRelease: (evt, gestureState) => {
        // Khi nhấc ngón tay lên. Nếu quãng đường di chuyển rất nhỏ thì coi như là Click chuột
        if (Math.abs(gestureState.dx) < 5 && Math.abs(gestureState.dy) < 5) {
          if (ws.current && ws.current.readyState === WebSocket.OPEN) {
            ws.current.send(JSON.stringify({ type: 'click' }));
          }
        }
      },
    })
  ).current;

  useEffect(() => {
    // Khóa màn hình xoay ngang (Landscape)
    ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.LANDSCAPE);

    if (!ip) return;

    // Khởi tạo kết nối WebSocket trực tiếp đến máy tính
    const socketUrl = `ws://${ip}:8080`;
    ws.current = new WebSocket(socketUrl);

    ws.current.onopen = () => {
      setStatus('Đã kết nối trực tiếp');
    };

    ws.current.onmessage = (event) => {
      // Máy tính sẽ gửi chuỗi base64 của ảnh chụp màn hình
      if (typeof event.data === 'string') {
        if (event.data.startsWith('data:image/jpeg;base64,')) {
          setFrame(event.data);
        }
      }
    };

    ws.current.onclose = () => {
      setStatus('Mất kết nối với máy tính');
    };

    ws.current.onerror = (error) => {
      console.log('WebSocket Error:', error);
      setStatus('Lỗi kết nối WebSocket');
    };

    return () => {
      // Nhả khóa xoay màn hình (trở lại dọc) khi thoát
      ScreenOrientation.unlockAsync();
      
      if (ws.current) {
        ws.current.close();
      }
    };
  }, [ip]);

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
            <Text style={styles.backText}>← Đóng</Text>
          </TouchableOpacity>
          <Text style={styles.title}>{status}</Text>
        </View>
        
        <View style={styles.content} {...panResponder.panHandlers}>
          {frame ? (
            <Image 
              source={{ uri: frame }} 
              style={styles.screenImage} 
              resizeMode="contain" 
            />
          ) : (
            <Text style={styles.placeholder}>
              Đang chờ dữ liệu màn hình...
            </Text>
          )}
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000', // Đen hoàn toàn để xem phim/màn hình tốt hơn
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#333',
    backgroundColor: '#1E1E1E',
  },
  backButton: {
    paddingRight: 16,
  },
  backText: {
    color: '#007AFF',
    fontSize: 16,
  },
  title: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: 'bold',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  screenImage: {
    width: '100%',
    height: '100%',
  },
  placeholder: {
    color: '#888',
    textAlign: 'center',
    fontSize: 14,
  },
});
