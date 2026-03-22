export const CATEGORIES = ["cpu", "gpu", "ram", "mobo", "psu"];

export const CATEGORY_LABELS = {
    cpu: "CPU",
    gpu: "GPU",
    ram: "RAM",
    mobo: "Motherboard",
    psu: "Power Supply",
};

export const partsData = {
    cpu: [
        { id: "cpu-1",  name: "AMD Ryzen 5 5600X",    price: 199, tdp: 65,  socket: "AM4",     img: "https://via.placeholder.com/56", alt: "Intel i5-12400F" },
        { id: "cpu-2",  name: "AMD Ryzen 7 5800X",    price: 299, tdp: 105, socket: "AM4",     img: "https://via.placeholder.com/56", alt: "Intel i7-12700F" },
        { id: "cpu-3",  name: "AMD Ryzen 9 5900X",    price: 399, tdp: 105, socket: "AM4",     img: "https://via.placeholder.com/56", alt: "Intel i9-12900K" },
        { id: "cpu-4",  name: "AMD Ryzen 5 7600X",    price: 249, tdp: 105, socket: "AM5",     img: "https://via.placeholder.com/56", alt: "Intel i5-13600K" },
        { id: "cpu-5",  name: "AMD Ryzen 7 7700X",    price: 349, tdp: 105, socket: "AM5",     img: "https://via.placeholder.com/56", alt: "Intel i7-13700K" },
        { id: "cpu-6",  name: "Intel Core i5-12400F", price: 169, tdp: 65,  socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 5 5600X" },
        { id: "cpu-7",  name: "Intel Core i5-13600K", price: 279, tdp: 125, socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 5 7600X" },
        { id: "cpu-8",  name: "Intel Core i7-12700F", price: 289, tdp: 65,  socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 7 5800X" },
        { id: "cpu-9",  name: "Intel Core i7-13700K", price: 379, tdp: 125, socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 7 7700X" },
        { id: "cpu-10", name: "Intel Core i9-13900K", price: 549, tdp: 125, socket: "LGA1700", img: "https://via.placeholder.com/56", alt: "Ryzen 9 7950X" },
    ],
     gpu: [
        { id: "gpu-1",  name: "NVIDIA RTX 3060",        price: 329, tdp: 170, img: "https://via.placeholder.com/56", alt: "AMD RX 6600" },
        { id: "gpu-2",  name: "NVIDIA RTX 3060 Ti",     price: 399, tdp: 200, img: "https://via.placeholder.com/56", alt: "AMD RX 6700 XT" },
        { id: "gpu-3",  name: "NVIDIA RTX 3070",        price: 499, tdp: 220, img: "https://via.placeholder.com/56", alt: "AMD RX 6800" },
        { id: "gpu-4",  name: "NVIDIA RTX 3080",        price: 699, tdp: 320, img: "https://via.placeholder.com/56", alt: "AMD RX 6800 XT" },
        { id: "gpu-5",  name: "NVIDIA RTX 4060",        price: 299, tdp: 115, img: "https://via.placeholder.com/56", alt: "AMD RX 7600" },
        { id: "gpu-6",  name: "NVIDIA RTX 4070",        price: 599, tdp: 200, img: "https://via.placeholder.com/56", alt: "AMD RX 7800 XT" },
        { id: "gpu-7",  name: "AMD Radeon RX 6600",     price: 249, tdp: 132, img: "https://via.placeholder.com/56", alt: "RTX 3060" },
        { id: "gpu-8",  name: "AMD Radeon RX 6700 XT",  price: 349, tdp: 230, img: "https://via.placeholder.com/56", alt: "RTX 3060 Ti" },
        { id: "gpu-9",  name: "AMD Radeon RX 6800 XT",  price: 549, tdp: 300, img: "https://via.placeholder.com/56", alt: "RTX 3080" },
        { id: "gpu-10", name: "AMD Radeon RX 7900 XTX", price: 949, tdp: 355, img: "https://via.placeholder.com/56", alt: "RTX 4080" },
    ],

    ram: [
        { id: "ram-1", name: "Corsair Vengeance 16GB DDR4-3200", price: 45,  type: "DDR4", img: "https://via.placeholder.com/56", alt: "G.Skill Ripjaws 16GB DDR4" },
        { id: "ram-2", name: "G.Skill Ripjaws 16GB DDR4-3600",  price: 55,  type: "DDR4", img: "https://via.placeholder.com/56", alt: "Corsair Vengeance 16GB DDR4" },
        { id: "ram-3", name: "Kingston Fury 32GB DDR4-3200",    price: 79,  type: "DDR4", img: "https://via.placeholder.com/56", alt: "Corsair Vengeance 32GB DDR4" },
        { id: "ram-4", name: "Corsair Vengeance 32GB DDR4-3600",price: 95,  type: "DDR4", img: "https://via.placeholder.com/56", alt: "G.Skill Ripjaws 32GB DDR4" },
        { id: "ram-5", name: "G.Skill Trident 64GB DDR4-3600",  price: 159, type: "DDR4", img: "https://via.placeholder.com/56", alt: "Corsair Dominator 64GB DDR4" },
        { id: "ram-6", name: "Corsair Vengeance 16GB DDR5-4800",price: 75,  type: "DDR5", img: "https://via.placeholder.com/56", alt: "Kingston Fury 16GB DDR5" },
        { id: "ram-7", name: "G.Skill Trident 32GB DDR5-6000",  price: 119, type: "DDR5", img: "https://via.placeholder.com/56", alt: "Corsair Dominator 32GB DDR5" },
        { id: "ram-8", name: "Kingston Fury 32GB DDR5-5200",    price: 109, type: "DDR5", img: "https://via.placeholder.com/56", alt: "G.Skill Trident 32GB DDR5" },
        { id: "ram-9", name: "Corsair Dominator 64GB DDR5-5600",price: 229, type: "DDR5", img: "https://via.placeholder.com/56", alt: "G.Skill Trident 64GB DDR5" },
    ],

    mobo: [
        { id: "mobo-1",  name: "MSI B550-A Pro",             price: 129, socket: "AM4",     ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "ASUS TUF B550-Plus" },
        { id: "mobo-2",  name: "ASUS TUF B550-Plus",         price: 149, socket: "AM4",     ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "MSI B550-A Pro" },
        { id: "mobo-3",  name: "ASUS ROG STRIX B550-F",      price: 180, socket: "AM4",     ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "MSI B550 Tomahawk" },
        { id: "mobo-4",  name: "MSI B550 Tomahawk",          price: 159, socket: "AM4",     ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "Gigabyte B550 Aorus" },
        { id: "mobo-5",  name: "ASUS ROG Crosshair X670E",   price: 349, socket: "AM5",     ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "MSI X670E Tomahawk" },
        { id: "mobo-6",  name: "MSI X670E Tomahawk",         price: 299, socket: "AM5",     ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "ASUS ROG Crosshair X670E" },
        { id: "mobo-7",  name: "Gigabyte B650 Aorus Elite",  price: 199, socket: "AM5",     ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "MSI B650 Tomahawk" },
        { id: "mobo-8",  name: "ASUS Prime Z690-A",          price: 219, socket: "LGA1700", ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "MSI Z690-A Pro" },
        { id: "mobo-9",  name: "MSI Z690-A Pro",             price: 189, socket: "LGA1700", ramType: "DDR4", img: "https://via.placeholder.com/56", alt: "ASUS Prime Z690-A" },
        { id: "mobo-10", name: "ASUS ROG Strix Z790-E",      price: 399, socket: "LGA1700", ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "MSI Z790 Edge" },
        { id: "mobo-11", name: "MSI Z790 Edge",              price: 329, socket: "LGA1700", ramType: "DDR5", img: "https://via.placeholder.com/56", alt: "ASUS ROG Strix Z790-E" },
    ],

    psu: [
        { id: "psu-1",  name: "EVGA 500W Bronze",          price: 49,  wattage: 500,  img: "https://via.placeholder.com/56", alt: "Corsair CV550" },
        { id: "psu-2",  name: "Corsair CV550",             price: 59,  wattage: 550,  img: "https://via.placeholder.com/56", alt: "EVGA 500W Bronze" },
        { id: "psu-3",  name: "Corsair CX650M",            price: 79,  wattage: 650,  img: "https://via.placeholder.com/56", alt: "EVGA 650W Gold" },
        { id: "psu-4",  name: "EVGA 650W Gold",            price: 89,  wattage: 650,  img: "https://via.placeholder.com/56", alt: "Corsair CX650M" },
        { id: "psu-5",  name: "Seasonic Focus GX-750",     price: 129, wattage: 750,  img: "https://via.placeholder.com/56", alt: "Corsair RM750x" },
        { id: "psu-6",  name: "Corsair RM750x",            price: 119, wattage: 750,  img: "https://via.placeholder.com/56", alt: "Seasonic Focus GX-750" },
        { id: "psu-7",  name: "be quiet! Pure Power 850W", price: 139, wattage: 850,  img: "https://via.placeholder.com/56", alt: "Corsair RM850x" },
        { id: "psu-8",  name: "Corsair RM850x",            price: 149, wattage: 850,  img: "https://via.placeholder.com/56", alt: "be quiet! Pure Power 850W" },
        { id: "psu-9",  name: "Seasonic Focus GX-1000",    price: 189, wattage: 1000, img: "https://via.placeholder.com/56", alt: "Corsair HX1000" },
        { id: "psu-10", name: "Corsair HX1000",            price: 199, wattage: 1000, img: "https://via.placeholder.com/56", alt: "Seasonic Focus GX-1000" },
    ],
};
