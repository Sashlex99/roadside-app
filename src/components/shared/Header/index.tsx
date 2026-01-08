import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from '../../../constants/colors';
import { LocationData, UserProfile } from '../../../types/shared';
import { styles } from './styles';

interface HeaderProps {
  user: UserProfile | null;
  location: LocationData | null;
  // Driver-specific props
  isOnline?: boolean;
  onToggleOnline?: () => void;
  onlineStatusSyncing?: boolean;
  // Client-specific props  
  onlineDriversCount?: number;
  // Shared props
  onSettingsPress: () => void;
}

// Helper function
const getFirstName = (fullName: string) => {
  return fullName.split(' ')[0] || fullName;
};

const truncateAddress = (address: string, maxLength: number = 50) => {
  if (address.length <= maxLength) return address;
  
  const truncated = address.substring(0, maxLength);
  const lastSpaceIndex = truncated.lastIndexOf(' ');
  
  if (lastSpaceIndex > maxLength * 0.7) {
    return truncated.substring(0, lastSpaceIndex) + '...';
  }
  
  return truncated + '...';
};

export default function Header({
  user,
  location,
  isOnline,
  onToggleOnline,
  onlineStatusSyncing,
  onlineDriversCount,
  onSettingsPress,
}: HeaderProps) {
  return (
    <View style={styles.header}>
      <View style={styles.headerLeft}>
        <Text style={styles.userName}>
          {getFirstName(user?.fullName || (user?.userType === 'driver' ? 'Шофьор' : 'Клиент'))}
        </Text>
        {location && (
          <Text style={styles.locationInHeader}>
            {truncateAddress(location.address)}
          </Text>
        )}
        
        {/* Client-specific: Online Drivers Indicator */}
        {user?.userType === 'client' && typeof onlineDriversCount === 'number' && (
          <View style={styles.onlineDriversIndicator}>
            <View style={[
              styles.onlineDriversDot,
              { backgroundColor: onlineDriversCount > 0 ? colors.success : colors.textSecondary }
            ]} />
            <Text style={styles.onlineDriversText}>
              {onlineDriversCount > 0 
                ? `${onlineDriversCount} шофьор${onlineDriversCount === 1 ? '' : 'и'} онлайн`
                : 'Няма активни шофьори'
              }
            </Text>
          </View>
        )}
      </View>
      
      <View style={styles.headerRight}>
        {/* Driver-specific: Online Status Toggle */}
        {user?.userType === 'driver' && typeof isOnline === 'boolean' && onToggleOnline && (
          <View style={styles.statusToggle}>
            <Switch
              value={isOnline}
              onValueChange={onToggleOnline}
              trackColor={{ false: '#E5E7EB', true: '#D1FAE5' }}
              thumbColor={isOnline ? '#10B981' : '#9CA3AF'}
              ios_backgroundColor="#E5E7EB"
              style={styles.switch}
              disabled={onlineStatusSyncing}
            />
          </View>
        )}
        
        <TouchableOpacity onPress={onSettingsPress} style={styles.settingsButton}>
          <Ionicons 
            name="settings-outline" 
            size={user?.userType === 'driver' ? 22 : 24} 
            color={user?.userType === 'driver' ? colors.textSecondary : colors.text} 
          />
        </TouchableOpacity>
      </View>
    </View>
  );
} 