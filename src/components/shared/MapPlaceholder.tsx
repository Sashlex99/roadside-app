import React from 'react';
import {
  View,
  Text,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../constants/colors';

interface MapPlaceholderProps {
  style?: any;
}

export default function MapPlaceholder({ style }: MapPlaceholderProps) {
  return (
    <View style={[styles.container, style]}>
      <View style={styles.placeholder}>
        <Ionicons name="map-outline" size={64} color="#ccc" />
        <Text style={styles.placeholderText}>Карта временно недостъпна</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    position: 'relative',
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
  },
  placeholderText: {
    color: '#999',
    marginTop: 8,
    fontSize: 14,
  },
}); 