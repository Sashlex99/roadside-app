import { StyleSheet } from 'react-native';
import { colors } from '../../../constants/colors';

export const styles = StyleSheet.create({
  activeOrderPanel: {
    backgroundColor: colors.primaryLight,
    padding: 16,
    borderRadius: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 3,
  },
  activeOrderHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 12,
  },
  activeOrderTitle: {
    fontSize: 16,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 4,
  },
  activeOrderDescription: {
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  activeOrderAddress: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 2,
  },
  activeOrderDestination: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  phoneButton: {
    backgroundColor: colors.primary,
    padding: 12,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  activeOrderActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  navigationButton: {
    backgroundColor: colors.primary,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    marginRight: 8,
  },
  completeButton: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    flex: 1,
    justifyContent: 'center',
    marginLeft: 8,
  },
  actionButtonText: {
    color: colors.textOnPrimary,
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 6,
  },
}); 