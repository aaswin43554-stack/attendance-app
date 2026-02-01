import React from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix for default marker icon in Leaflet + React
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: markerIcon2x,
    iconUrl: markerIcon,
    shadowUrl: markerShadow,
});

function ChangeView({ center, zoom }) {
    const map = useMap();
    map.setView(center, zoom);
    return null;
}

export default function LocationMap({ lat, lng, address, height = "250px" }) {
    const fLat = parseFloat(lat);
    const fLng = parseFloat(lng);
    const position = [fLat, fLng];

    if (isNaN(fLat) || isNaN(fLng)) {
        return <div className="muted small">Location data unavailable for map.</div>;
    }

    return (
        <div style={{ height, width: "100%", borderRadius: "8px", overflow: "hidden", marginTop: "10px", border: "1px solid var(--border)" }}>
            <MapContainer center={position} zoom={13} scrollWheelZoom={false} style={{ height: "100%", width: "100%" }}>
                <ChangeView center={position} zoom={13} />
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={position}>
                    {address && (
                        <Popup>
                            {address}
                        </Popup>
                    )}
                </Marker>
            </MapContainer>
        </div>
    );
}
