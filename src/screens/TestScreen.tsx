import React, { useState } from 'react';
import { View, Text, TouchableOpacity, Alert, Image, StyleSheet } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors } from '../constants/colors';
import { convertImageToBase64 } from '../services/imageHelpers';

export default function TestScreen() {
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const testImagePicker = async () => {
    try {
      setDebugInfo('Starting image picker test...');
      
      // Test permissions first
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      setDebugInfo(prev => prev + '\nMedia library permission: ' + status);
      
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please grant access to media library');
        return;
      }

      // Try to pick an image
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        quality: 0.6,
        base64: false,
      });

      setDebugInfo(prev => prev + '\nImage picker result: ' + JSON.stringify({
        canceled: result.canceled,
        assets: result.assets ? result.assets.length : 0
      }));

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setDebugInfo(prev => prev + '\nImage URI: ' + uri);
        
        // Test conversion
        try {
          const base64 = await convertImageToBase64(uri);
          setSelectedImage(base64);
          setDebugInfo(prev => prev + '\nConversion successful, size: ' + Math.round(base64.length / 1024) + 'KB');
        } catch (conversionError) {
          setDebugInfo(prev => prev + '\nConversion error: ' + conversionError);
        }
      }
    } catch (error) {
      setDebugInfo(prev => prev + '\nError: ' + error);
      Alert.alert('Error', 'Something went wrong: ' + error);
    }
  };

  const testCamera = async () => {
    try {
      setDebugInfo('Starting camera test...');
      
      // Test camera permissions
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      setDebugInfo(prev => prev + '\nCamera permission: ' + status);
      
      if (status !== 'granted') {
        Alert.alert('Permission denied', 'Please grant access to camera');
        return;
      }

      // Try to take a photo
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 0.6,
        base64: false,
      });

      setDebugInfo(prev => prev + '\nCamera result: ' + JSON.stringify({
        canceled: result.canceled,
        assets: result.assets ? result.assets.length : 0
      }));

      if (!result.canceled && result.assets[0]) {
        const uri = result.assets[0].uri;
        setDebugInfo(prev => prev + '\nCamera URI: ' + uri);
        
        // Test conversion
        try {
          const base64 = await convertImageToBase64(uri);
          setSelectedImage(base64);
          setDebugInfo(prev => prev + '\nConversion successful, size: ' + Math.round(base64.length / 1024) + 'KB');
        } catch (conversionError) {
          setDebugInfo(prev => prev + '\nConversion error: ' + conversionError);
        }
      }
    } catch (error) {
      setDebugInfo(prev => prev + '\nError: ' + error);
      Alert.alert('Error', 'Something went wrong: ' + error);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Image Picker Test</Text>
      
      <TouchableOpacity style={styles.button} onPress={testImagePicker}>
        <Text style={styles.buttonText}>Test Gallery</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.button} onPress={testCamera}>
        <Text style={styles.buttonText}>Test Camera</Text>
      </TouchableOpacity>
      
      <TouchableOpacity style={styles.clearButton} onPress={() => {
        setSelectedImage(null);
        setDebugInfo('');
      }}>
        <Text style={styles.clearButtonText}>Clear</Text>
      </TouchableOpacity>
      
      {selectedImage && (
        <View style={styles.imageContainer}>
          <Text style={styles.successText}>Image loaded successfully!</Text>
          <Image source={{ uri: selectedImage }} style={styles.image} />
        </View>
      )}
      
      {debugInfo && (
        <View style={styles.debugContainer}>
          <Text style={styles.debugTitle}>Debug Info:</Text>
          <Text style={styles.debugText}>{debugInfo}</Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginBottom: 30,
  },
  button: {
    backgroundColor: colors.primary,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  buttonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  clearButton: {
    backgroundColor: colors.error,
    padding: 15,
    borderRadius: 10,
    marginBottom: 15,
    alignItems: 'center',
  },
  clearButtonText: {
    color: colors.textOnPrimary,
    fontSize: 16,
    fontWeight: 'bold',
  },
  imageContainer: {
    marginTop: 20,
    alignItems: 'center',
  },
  successText: {
    color: colors.success,
    fontSize: 16,
    fontWeight: 'bold',
    marginBottom: 10,
  },
  image: {
    width: 200,
    height: 200,
    borderRadius: 10,
  },
  debugContainer: {
    marginTop: 20,
    padding: 15,
    backgroundColor: colors.surface,
    borderRadius: 10,
  },
  debugTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 10,
  },
  debugText: {
    fontSize: 12,
    color: colors.textSecondary,
    lineHeight: 16,
  },
}); 