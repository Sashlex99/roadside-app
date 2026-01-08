import { Alert, Linking } from 'react-native';
import { getUser } from '../../services/firestore';

// Helper function to calculate distance (same as in firestore service)
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371; // Earth's radius in kilometers
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  const straightLineDistance = R * c;
  
  // Добавяме 35% за пътища, завои и реални условия
  return straightLineDistance * 1.35;
};

// Format time ago helper
export const formatTimeAgo = (date: Date): string => {
  const minutes = Math.floor((Date.now() - date.getTime()) / (1000 * 60));
  if (minutes < 60) return `преди ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  return `преди ${hours} ч`;
};

// Generate map HTML for WebView (same as client screen)
export const generateMapHTML = (location: { latitude: number; longitude: number }, colors: any): string => {
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
          width: 16px;
          height: 16px;
          border-radius: 50%;
          border: 2px solid white;
          box-shadow: 0 2px 6px rgba(0,0,0,0.3);
          position: relative;
        }
        .custom-marker::after {
          content: '';
          position: absolute;
          top: 50%;
          left: 50%;
          transform: translate(-50%, -50%);
          width: 6px;
          height: 6px;
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
        /* More discrete zoom controls */
        .leaflet-control-zoom a {
          background-color: rgba(255,255,255,0.9) !important;
          border: none !important;
          color: #666 !important;
          width: 28px !important;
          height: 28px !important;
          line-height: 28px !important;
          font-size: 14px !important;
          box-shadow: 0 2px 8px rgba(0,0,0,0.15) !important;
        }
        .leaflet-control-zoom a:hover {
          background-color: white !important;
          color: ${colors.primary} !important;
        }
        .leaflet-control-zoom {
          border: none !important;
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
            iconSize: [32, 32],
            iconAnchor: [16, 16],
            html: '<div style="width: 32px; height: 32px; border-radius: 50%; background-color: ${colors.primary}; opacity: 0.3;"></div>'
          })
        }).addTo(map);
        
        // Custom marker icon on top
        var customIcon = L.divIcon({
          className: 'custom-marker',
          iconSize: [16, 16],
          iconAnchor: [8, 8],
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
          console.log('🗺️ Driver map location updated:', newLat, newLng);
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

// Open Google Maps navigation
export const openGoogleMaps = (order: any, acceptedOrder?: any) => {
  // Use client location from accepted order, not driver location
  const lat = acceptedOrder?.location?.latitude || order.location?.latitude;
  const lng = acceptedOrder?.location?.longitude || order.location?.longitude;
  if (lat && lng) {
    const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
    Linking.openURL(url).catch(() => {
      Alert.alert('Грешка', 'Не можахме да отворим Google Maps');
    });
  }
};

// Make phone call to client
export const makePhoneCall = (acceptedOrder: any, acceptedBid: any) => {
  // Debug: Log the accepted order structure
  console.log('makePhoneCall - acceptedOrder:', acceptedOrder);
  console.log('makePhoneCall - acceptedBid:', acceptedBid);
  
  // Try different possible paths for the phone number
  const phoneFromOrder = acceptedOrder?.clientInfo?.phone;
  const phoneFromBid = acceptedBid?.orderInfo?.clientInfo?.phone;
  const phoneFromBidClient = acceptedBid?.clientInfo?.phone;
  
  console.log('Phone from order:', `"${phoneFromOrder}"`);
  console.log('Phone from bid (orderInfo):', `"${phoneFromBid}"`);
  console.log('Phone from bid (direct):', `"${phoneFromBidClient}"`);
  
  // Check if phone is just empty string
  console.log('Phone from order length:', phoneFromOrder?.length);
  console.log('Phone from order trimmed:', phoneFromOrder?.trim());
  
  // Find first non-empty phone number
  const phoneNumber = [phoneFromOrder, phoneFromBid, phoneFromBidClient]
    .find(phone => phone && phone.trim() !== '');
  
  if (!phoneNumber) {
    console.log('No valid phone number found, attempting to fetch user profile');
    if (acceptedOrder?.clientId) {
      getUser(acceptedOrder.clientId).then(profile => {
        if (profile?.phone) {
          Linking.openURL(`tel:${profile.phone}`).catch(() => {
            Alert.alert('Грешка', 'Не можахме да отворим приложението за телефон');
          });
        } else {
          Alert.alert('Грешка', 'Клиентът няма добавен телефонен номер');
        }
      });
    } else {
      Alert.alert('Грешка', 'Клиентът няма добавен телефонен номер или номерът е празен.');
    }
    return;
  }
  
  console.log('Making call to:', phoneNumber);
  Linking.openURL(`tel:${phoneNumber}`).catch((error) => {
    console.error('Failed to make call:', error);
    Alert.alert('Грешка', 'Не можахме да отворим приложението за телефон');
  });
};

// Check if driver should show orders modal
export const shouldShowOrdersModal = (isOnline: boolean, setCustomModal: any, colors: any) => {
  if (!isOnline) {
    setCustomModal({
      visible: true,
      title: 'Офлайн статус',
      message: 'Трябва да сте онлайн за да виждате поръчки. Включете онлайн статуса от превключвателя в горната част.',
      icon: 'pause-circle',
      iconColor: '#9CA3AF',
      buttons: [{
        text: 'Разбрах',
        onPress: () => setCustomModal((prev: any) => ({ ...prev, visible: false }))
      }]
    });
    return false;
  }
  return true;
}; 