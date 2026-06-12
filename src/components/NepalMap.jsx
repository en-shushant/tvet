import { useRef, useEffect } from 'react';

// ─── NEPAL MAP ───────────────────────────────────────────────────────────────

// Approximate coordinates for districts (major ones used for institute addresses)
const DISTRICT_COORDS = {
  'Kathmandu': [27.7172, 85.3240], 'Lalitpur': [27.6588, 85.3247],
  'Bhaktapur': [27.6710, 85.4298], 'Kavrepalanchok': [27.5700, 85.6800],
  'Chitwan': [27.5291, 84.3542], 'Makwanpur': [27.4333, 84.9833],
  'Kaski': [28.2096, 83.9856], 'Morang': [26.6549, 87.4320],
  'Sunsari': [26.6333, 87.1667], 'Dhankuta': [26.9833, 87.3333],
  'Rupandehi': [27.5333, 83.4500], 'Banke': [28.0500, 81.6167],
  'Kailali': [28.7000, 80.9000], 'Dang': [28.0000, 82.3000],
  'Sindhupalchok': [27.9500, 85.7000], 'Dhading': [27.8667, 84.9000],
  'Nuwakot': [27.9167, 85.1667], 'Rasuwa': [28.1667, 85.3667],
  'Dolakha': [27.6667, 86.1333], 'Ramechhap': [27.3333, 86.0833],
  'Sindhuli': [27.2500, 85.9833], 'Sarlahi': [26.9667, 85.5833],
  'Mahottari': [26.8500, 85.9000], 'Dhanusha': [26.8167, 86.0333],
  'Siraha': [26.6500, 86.2167], 'Saptari': [26.6333, 86.7333],
  'Udayapur': [26.8833, 86.5500], 'Bara': [27.0167, 84.8500],
  'Parsa': [27.1500, 84.5000], 'Rautahat': [27.0000, 85.0000],
  'Nawalparasi (East)': [27.5500, 84.0833], 'Nawalparasi (West)': [27.6500, 83.7500],
  'Palpa': [27.8667, 83.5500], 'Syangja': [28.0833, 83.8833],
  'Tanahun': [28.0167, 84.2833], 'Lamjung': [28.2167, 84.3833],
  'Gorkha': [28.0000, 84.6333], 'Manang': [28.6667, 84.0167],
  'Mustang': [29.1667, 83.8333], 'Parbat': [28.2333, 83.6833],
  'Baglung': [28.2667, 83.5833], 'Myagdi': [28.4500, 83.2833],
  'Gulmi': [28.0667, 83.2833], 'Arghakhanchi': [27.9500, 82.9833],
  'Kapilvastu': [27.5667, 83.0500], 'Pyuthan': [28.1000, 82.8333],
  'Rolpa': [28.3000, 82.6167], 'Salyan': [28.3667, 82.1667],
  'Surkhet': [28.6000, 81.6167], 'Dailekh': [28.8333, 81.7167],
  'Jajarkot': [28.7000, 82.1833], 'Dolpa': [29.0000, 82.8333],
  'Jumla': [29.2750, 82.1833], 'Mugu': [29.5833, 82.5167],
  'Humla': [30.0000, 81.5000], 'Kalikot': [29.1333, 81.6333],
  'Bardiya': [28.3000, 81.3333], 'Kanchanpur': [28.9500, 80.5500],
  'Dadeldhura': [29.3000, 80.5833], 'Baitadi': [29.5167, 80.5333],
  'Darchula': [29.8500, 80.5333], 'Doti': [29.2667, 81.0000],
  'Achham': [29.0833, 81.1833], 'Bajura': [29.5000, 81.2500],
  'Bajhang': [29.5833, 81.1833], 'Bhojpur': [27.1667, 87.0500],
  'Terhathum': [27.1167, 87.5500], 'Sankhuwasabha': [27.4000, 87.3333],
  'Solukhumbu': [27.7833, 86.5833], 'Okhaldhunga': [27.3167, 86.5000],
  'Khotang': [27.1667, 86.8333], 'Ilam': [26.9167, 87.9167],
  'Panchthar': [27.1167, 87.8167], 'Taplejung': [27.3500, 87.6667],
  'Jhapa': [26.6167, 87.8667],
};

const NEPAL_BOUNDS = [[26.347, 80.058], [30.447, 88.201]];

// Simplified Nepal boundary polygon [lat, lng] — used for world mask
const NEPAL_POLY = [
  [28.794,80.088],[29.294,80.257],[29.626,80.088],[29.867,80.478],
  [30.014,81.112],[30.145,81.410],[30.422,81.526],[30.422,81.900],
  [30.217,82.048],[30.115,82.327],[29.815,82.604],[29.721,82.932],
  [29.464,83.338],[29.184,83.594],[29.044,83.900],[28.988,84.101],
  [28.849,84.433],[28.553,84.675],[28.323,85.251],[28.247,85.481],
  [28.147,85.674],[27.976,85.707],[27.949,85.887],[27.974,86.175],
  [27.974,86.746],[27.882,87.227],[27.922,87.570],[28.087,87.817],
  [27.869,88.120],[27.511,88.168],[27.271,88.168],[27.024,87.960],
  [26.866,87.550],[26.602,87.227],[26.398,87.224],[26.398,86.590],
  [26.450,86.024],[26.631,85.736],[26.726,85.251],[26.849,84.955],
  [27.234,84.675],[27.499,84.101],[27.364,83.332],[27.432,83.068],
  [27.972,82.327],[27.932,81.526],[27.914,81.112],[27.914,80.847],
  [28.294,80.478],[28.632,80.259],[28.794,80.088]
];

function NepalMap({institutes, onSelect}) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);

  useEffect(() => {
    if(!window.L) return;
    if(!mapInstanceRef.current) {
      mapInstanceRef.current = window.L.map(mapRef.current, {
        center: [28.3949, 84.1240],
        zoom: 7,
        minZoom: 6,
        maxZoom: 14,
        maxBounds: NEPAL_BOUNDS,
        maxBoundsViscosity: 1.0,
        zoomControl: true,
      });

      window.L.tileLayer(
        'https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png?api_key=57ef08c2-4393-4cba-8ca4-fb40a65b34b5',
        {
          attribution: '© Stadia Maps © OpenMapTiles © OpenStreetMap contributors',
          maxZoom: 14,
        }
      ).addTo(mapInstanceRef.current);

      // Restrict initial view to Nepal
      mapInstanceRef.current.fitBounds(NEPAL_BOUNDS);
    }

    markersRef.current.forEach(m => m.remove());
    markersRef.current = [];

    institutes.forEach(inst => {
      let coords = null;
      let isPrecise = false;
      if (inst.latitude && inst.longitude) {
        coords = [parseFloat(inst.latitude), parseFloat(inst.longitude)];
        isPrecise = true;
      } else {
        for(const [district, c] of Object.entries(DISTRICT_COORDS)) {
          if(inst.address && inst.address.toLowerCase().includes(district.toLowerCase())) {
            coords = c; break;
          }
        }
        if(!coords) coords = [27.7172 + (Math.random()-0.5)*0.3, 85.3240 + (Math.random()-0.5)*0.3];
      }

      const color = inst.status === 'Active' ? '#2D5A3D' : inst.status === 'Pending Renewal' ? '#C4730A' : '#B53A2F';
      const size = isPrecise ? 14 : 11;
      const icon = window.L.divIcon({
        className: '',
        html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid white;box-shadow:0 1px 4px rgba(0,0,0,0.3);cursor:pointer;${isPrecise ? '' : 'opacity:0.7;'}"></div>`,
        iconSize: [size, size],
        iconAnchor: [size/2, size/2],
      });

      const coordStr = isPrecise
        ? `<br/><span style="color:#888;font-size:10px;font-family:monospace">${parseFloat(inst.latitude).toFixed(5)}, ${parseFloat(inst.longitude).toFixed(5)}</span>`
        : `<br/><span style="color:#aaa;font-size:10px">📍 Approximate location</span>`;
      const mapsUrl = isPrecise
        ? `https://www.google.com/maps?q=${inst.latitude},${inst.longitude}`
        : inst.googleMapLink || '';
      const mapLink = mapsUrl
        ? `<br/><a href="${mapsUrl}" target="_blank" rel="noreferrer" style="color:#2563eb;font-size:11px;">📍 Open in Google Maps</a>`
        : '';

      const marker = window.L.marker(coords, {icon})
        .addTo(mapInstanceRef.current)
        .bindPopup(
          `<strong style="font-size:13px">${inst.acronym ? '['+inst.acronym+'] ' : ''}${inst.name}</strong>` +
          `<br/><span style="color:#666;font-size:11px">${inst.address||''}</span>` +
          `<br/><span style="color:${color};font-size:11px;font-weight:600">${inst.status}</span>` +
          coordStr + mapLink
        );

      marker.on('click', () => onSelect(inst));
      markersRef.current.push(marker);
    });
  }, [institutes]);

  return <div ref={mapRef} style={{height:320, width:'100%', borderRadius:8, overflow:'hidden'}}/>;
}


export { DISTRICT_COORDS };
export default NepalMap;
