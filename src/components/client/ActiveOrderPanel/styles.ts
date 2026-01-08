import { StyleSheet } from 'react-native';
import { colors } from '../../../constants/colors';

export const styles = StyleSheet.create({
  activeOrderPanel: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 12,
    marginBottom: 20,
  },
  activeOrderTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  activeOrderCountdown: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  activeOrderSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  offersBadge: {
    backgroundColor: colors.primary,
    borderRadius: 12,
    padding: 4,
  },
  offersBadgeText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.textOnPrimary,
  },
  acceptedOrderTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  acceptedDriverName: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  acceptedOrderSubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  cancelButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.error,
    padding: 12,
    borderRadius: 12,
    marginTop: 8,
  },
  cancelButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: 'bold',
    marginLeft: 6,
  },
}); 