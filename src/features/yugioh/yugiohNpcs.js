export const YUGIOH_NPCS = {
  yugi: { id: 'yugi', name: 'Muto Yugi', palette: { skin: '#f1c27d', hair: '#e0e0e0', outfit: '#7a2fd6', hairStyle: 'Spiky' } },
  kaiba: { id: 'kaiba', name: 'Seto Kaiba', palette: { skin: '#f1c27d', hair: '#5a3825', outfit: '#333333', hairStyle: 'Long' } },
  joey: { id: 'joey', name: 'Joey Wheeler', palette: { skin: '#e0ac69', hair: '#c99b3c', outfit: '#3f6fd6', hairStyle: 'Short' } },
  tea: { id: 'tea', name: 'Téa Gardner', palette: { skin: '#f1c27d', hair: '#5a3825', outfit: '#2f9e44', hairStyle: 'Long' } },
  tristan: { id: 'tristan', name: 'Tristan Taylor', palette: { skin: '#c68642', hair: '#1a1a1a', outfit: '#f2b705', hairStyle: 'Spiky' } },
  solomon: { id: 'solomon', name: 'Solomon Muto', palette: { skin: '#e0ac69', hair: '#e0e0e0', outfit: '#5a3825', hairStyle: 'Short' } },
  duke: { id: 'duke', name: 'Duke Devlin', palette: { skin: '#f1c27d', hair: '#1a1a1a', outfit: '#333333', hairStyle: 'Ponytail' } },
  tah: { id: 'tah', name: 'Tah', palette: { skin: '#e0ac69', hair: '#1a1a1a', outfit: '#d64545', hairStyle: 'Spiky' } },
  cynn: { id: 'cynn', name: 'Cynn', palette: { skin: '#f1c27d', hair: '#8b0000', outfit: '#7a2fd6', hairStyle: 'Long' } },
}

export function getYugiohNpc(id) {
  return YUGIOH_NPCS[id]
}
