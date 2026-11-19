import type { VehicleType } from "./templates";

// Makes and models common on Malaysian roads, offered as suggestions on the vehicle form.
// Suggestions only: the user can type any make or model.

export type CommonModel = { make: string; model: string };

export const COMMON_MODELS: Record<VehicleType, Record<string, readonly string[]>> = {
  car: {
    Perodua: ["Myvi", "Axia", "Bezza", "Alza", "Ativa", "Aruz", "Viva", "Kancil", "Kelisa", "Kenari", "Kembara"],
    Proton: ["Saga", "Persona", "Iriz", "X50", "X70", "X90", "S70", "Exora", "Preve", "Waja", "Wira", "Satria", "Perdana"],
    Honda: ["City", "Civic", "HR-V", "CR-V", "Jazz", "BR-V", "WR-V", "Accord"],
    Toyota: ["Vios", "Yaris", "Corolla Cross", "Corolla", "Camry", "Hilux", "Innova", "Veloz", "Rush", "Fortuner", "Alphard", "Vellfire"],
    Nissan: ["Almera", "Serena", "X-Trail", "Navara"],
    Mazda: ["Mazda2", "Mazda3", "CX-3", "CX-30", "CX-5", "CX-8"],
    Mitsubishi: ["Xpander", "Triton", "ASX", "Outlander"],
    Isuzu: ["D-Max", "MU-X"],
    Ford: ["Ranger", "Everest"],
    Hyundai: ["Elantra", "Tucson", "Santa Fe", "Ioniq 5"],
    Kia: ["Seltos", "Sportage", "Carnival"],
    Suzuki: ["Swift", "Ertiga"],
    Subaru: ["XV", "Forester"],
    Volkswagen: ["Polo", "Vento", "Golf", "Passat", "Tiguan"],
    "Mercedes-Benz": ["A-Class", "C-Class", "E-Class", "GLC"],
    BMW: ["3 Series", "5 Series", "X1", "X3"],
    Chery: ["Omoda 5", "Tiggo 7 Pro", "Tiggo 8 Pro"],
    BYD: ["Atto 3", "Dolphin", "Seal", "M6"],
    Tesla: ["Model 3", "Model Y"],
  },
  motorbike: {
    Honda: ["Wave 125", "Wave Alpha", "EX5", "Dash 125", "RS150R", "RS-X", "Beat", "Vario 160", "PCX 160", "ADV 160"],
    Yamaha: ["Y16ZR", "Y15ZR", "LC135", "Ego Gear", "Lagenda", "NVX", "Aerox", "R15", "MT-15", "XMAX"],
    Modenas: ["Kriss", "Kriss MR3", "CT115S", "Dinamik", "Elegan"],
    Suzuki: ["Belang R150", "Raider R150", "Smash", "Avenis"],
    Kawasaki: ["Ninja 250", "Z250", "Versys 650"],
    SYM: ["VF3i", "Jet 14"],
    Benelli: ["RFS150i", "TNT 135"],
    Vespa: ["Sprint", "Primavera"],
    KTM: ["Duke 200", "Duke 390"],
  },
};

/** The quick picks above the form: the best sellers, one tap to fill make, model and name. */
export const QUICK_PICKS: Record<VehicleType, readonly CommonModel[]> = {
  car: [
    { make: "Perodua", model: "Myvi" },
    { make: "Perodua", model: "Axia" },
    { make: "Perodua", model: "Bezza" },
    { make: "Proton", model: "Saga" },
    { make: "Proton", model: "Persona" },
    { make: "Proton", model: "X50" },
    { make: "Honda", model: "City" },
    { make: "Toyota", model: "Vios" },
  ],
  motorbike: [
    { make: "Honda", model: "Wave 125" },
    { make: "Honda", model: "EX5" },
    { make: "Honda", model: "RS150R" },
    { make: "Yamaha", model: "Y16ZR" },
    { make: "Yamaha", model: "LC135" },
    { make: "Yamaha", model: "NVX" },
    { make: "Honda", model: "Vario 160" },
    { make: "Modenas", model: "Kriss" },
  ],
};

/** Placeholders that suit the vehicle type. */
export const EXAMPLES: Record<VehicleType, { make: string; model: string; name: string; plate: string }> = {
  car: { make: "Perodua", model: "Myvi", name: "Myvi, or Mum's car", plate: "WXY 1234" },
  motorbike: { make: "Honda", model: "Wave 125", name: "Wave, or Work bike", plate: "BKL 5678" },
};
