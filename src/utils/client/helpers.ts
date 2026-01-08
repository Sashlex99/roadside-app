import { colors } from '../../constants/colors';
import { updateOrderStatus, cancelOrder } from '../../services/firestore';
import { CustomModal as CustomModalType } from '../../types/shared';
import { LocationData } from '../../types/shared';

/**
 * Generate map HTML for WebView with user location
 */
export const generateMapHTML = (location: LocationData): string => {
  if (!location) return '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1">
      <link rel="stylesheet" href="https://unpkg.com/leaflet@1.7.1/dist/leaflet.css" />
      <script src="https://unpkg.com/leaflet@1.7.1/dist/leaflet.js"></script>
      <style>
        body { margin: 0; padding: 0; }
        #map { height: 100vh; width: 100vw; }
        .custom-marker {
          background-color: ${colors.primary};
          width: 20px;
          height: 20px;
          border-radius: 50%;
          border: 3px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.4);
          position: relative;
        }
        .custom-marker::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 8px;
          height: 8px;
          background-color: white;
          border-radius: 50%;
        }
        @keyframes pulse {
          0% { transform: scale(0.5); opacity: 0.8; }
          50% { transform: scale(1); opacity: 0.3; }
          100% { transform: scale(1.5); opacity: 0; }
        }
        .pulse-marker {
          animation: pulse 2s infinite;
        }
        /* Style zoom controls to match app theme */
        .leaflet-control-zoom a {
          background-color: white !important;
          border: 1px solid ${colors.primary} !important;
          color: ${colors.primary} !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: ${colors.primary} !important;
          color: white !important;
        }
      </style>
    </head>
    <body>
      <div id="map"></div>
      <script>
        var map = L.map('map', {
          zoomControl: true,
          attributionControl: false
        }).setView([${location.latitude}, ${location.longitude}], 16);
        
        // Use Carto Positron theme - very clean, minimal Google Maps-like style
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png', {
          attribution: '',
          subdomains: 'abcd',
          maxZoom: 20
        }).addTo(map);
        
        // Add road labels on top for clarity
        L.tileLayer('https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png', {
          attribution: '',
          subdomains: 'abcd',
          maxZoom: 20,
          opacity: 0.7
        }).addTo(map);
        
        // Add subtle pulse effect background
        var pulseMarker = L.marker([${location.latitude}, ${location.longitude}], {
          icon: L.divIcon({
            className: 'pulse-marker',
            iconSize: [40, 40],
            iconAnchor: [20, 20],
            html: '<div style="width: 40px; height: 40px; border-radius: 50%; background-color: ${colors.primary}; opacity: 0.3;"></div>'
          })
        }).addTo(map);
        
        // Custom marker icon on top
        var customIcon = L.divIcon({
          className: 'custom-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10],
          html: ''
        });
        
        var marker = L.marker([${location.latitude}, ${location.longitude}], {
          icon: customIcon
        }).addTo(map);
        
        // Enable all interactions for full interactivity
        map.scrollWheelZoom.enable();
        map.doubleClickZoom.enable();
        map.dragging.enable();
        map.touchZoom.enable();
        map.boxZoom.enable();
        map.keyboard.enable();
        if (map.tap) map.tap.enable();
        
        // Set zoom limits for better experience
        map.setMinZoom(10);
        map.setMaxZoom(20);
        
        // Function to update user location from React Native
        window.updateUserLocation = function(newLat, newLng) {
          // Update main marker
          marker.setLatLng([newLat, newLng]);
          // Update pulse marker
          pulseMarker.setLatLng([newLat, newLng]);
          // Center map on new location with smooth animation
          map.panTo([newLat, newLng], {
            animate: true,
            duration: 1
          });
          console.log('🗺️ Map location updated:', newLat, newLng);
        };
        
        // Notify React Native that map is ready
        setTimeout(() => {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapReady',
              location: [${location.latitude}, ${location.longitude}]
            }));
          }
        }, 1000);
        
        // Send map click events to React Native
        map.on('click', function(e) {
          if (window.ReactNativeWebView) {
            window.ReactNativeWebView.postMessage(JSON.stringify({
              type: 'mapClick',
              coordinates: {
                latitude: e.latlng.lat,
                longitude: e.latlng.lng
              }
            }));
          }
        });
      </script>
    </body>
    </html>
  `;
};

/**
 * Format milliseconds to M:SS string
 */
export const formatTimeRemaining = (ms: number): string => {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
};

/**
 * Cancel active order with confirmation modal
 */
export const createCancelOrderHandler = (
  activeOrder: any,
  setCustomModal: React.Dispatch<React.SetStateAction<CustomModalType>>
) => {
  return () => {
    if (!activeOrder) return;
    
    setCustomModal({
      visible: true,
      title: 'Отказване на заявка',
      message: 'Сигурни ли сте, че искате да отмените заявката?',
      icon: 'warning-outline',
      iconColor: colors.error,
      buttons: [
        {
          text: 'Не',
          onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
        },
        {
          text: 'Да, отмени',
          style: 'destructive',
          onPress: async () => {
            setCustomModal(prev => ({ ...prev, visible: false }));
            try {
              await cancelOrder(activeOrder.id);
              setCustomModal({
                visible: true,
                title: 'Отменено',
                message: 'Заявката е отменена успешно.',
                icon: 'checkmark-circle',
                iconColor: '#10B981',
                buttons: [{
                  text: 'Разбрах',
                  onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
                }]
              });
            } catch (err) {
              console.error('Error cancelling order:', err);
              setCustomModal({
                visible: true,
                title: 'Грешка',
                message: 'Не успяхме да отменим заявката.',
                icon: 'warning-outline',
                iconColor: colors.error,
                buttons: [{
                  text: 'Разбрах',
                  onPress: () => setCustomModal(prev => ({ ...prev, visible: false }))
                }]
              });
            }
          }
        }
      ]
    });
  };
}; 