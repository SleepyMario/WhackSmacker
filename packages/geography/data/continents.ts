export type Coordinate = readonly [longitude: number, latitude: number];
export type Polygon = readonly Coordinate[];

export interface ContinentDefinition {
  readonly id: "africa" | "americas" | "asia" | "europe" | "oceania" | "antarctica";
  readonly name: string;
  readonly sourceContinents: readonly string[];
  readonly polygons: readonly Polygon[];
}

export const continentDefinitions: readonly ContinentDefinition[] = [
  {
    id: "africa",
    name: "Africa",
    sourceContinents: ["Africa"],
    polygons: [
      [
        [-17, 36],
        [10, 37],
        [32, 31],
        [51, 12],
        [43, -12],
        [34, -35],
        [18, -35],
        [7, -28],
        [-9, -6],
        [-17, 14],
        [-17, 36]
      ],
      [
        [43, -12],
        [50, -16],
        [49, -25],
        [44, -25],
        [43, -12]
      ]
    ]
  },
  {
    id: "americas",
    name: "The Americas",
    sourceContinents: ["North America", "South America"],
    polygons: [
      [
        [-168, 72],
        [-132, 71],
        [-94, 58],
        [-58, 52],
        [-52, 25],
        [-75, 8],
        [-100, 16],
        [-118, 32],
        [-126, 49],
        [-168, 72]
      ],
      [
        [-82, 13],
        [-68, 12],
        [-49, -2],
        [-35, -15],
        [-53, -55],
        [-70, -54],
        [-81, -31],
        [-78, -7],
        [-82, 13]
      ],
      [
        [-55, 84],
        [-25, 82],
        [-18, 65],
        [-43, 59],
        [-62, 68],
        [-55, 84]
      ],
      [
        [-82, 22],
        [-74, 23],
        [-74, 18],
        [-84, 17],
        [-82, 22]
      ]
    ]
  },
  {
    id: "asia",
    name: "Asia",
    sourceContinents: ["Asia"],
    polygons: [
      [
        [26, 72],
        [62, 78],
        [116, 74],
        [180, 68],
        [180, 9],
        [139, 4],
        [104, -8],
        [73, 7],
        [46, 25],
        [26, 42],
        [26, 72]
      ],
      [
        [69, 23],
        [90, 27],
        [98, 8],
        [80, 6],
        [69, 23]
      ],
      [
        [100, 8],
        [110, 22],
        [121, 5],
        [107, -7],
        [100, 8]
      ],
      [
        [129, 34],
        [146, 45],
        [145, 31],
        [132, 31],
        [129, 34]
      ],
      [
        [44, 25],
        [58, 30],
        [56, 16],
        [46, 13],
        [44, 25]
      ]
    ]
  },
  {
    id: "europe",
    name: "Europe",
    sourceContinents: ["Europe"],
    polygons: [
      [
        [-11, 36],
        [8, 36],
        [30, 45],
        [42, 59],
        [29, 71],
        [5, 71],
        [-10, 60],
        [-11, 36]
      ],
      [
        [-8, 58],
        [2, 58],
        [1, 50],
        [-7, 50],
        [-8, 58]
      ],
      [
        [10, 56],
        [24, 66],
        [31, 60],
        [18, 55],
        [10, 56]
      ]
    ]
  },
  {
    id: "oceania",
    name: "Oceania",
    sourceContinents: ["Oceania"],
    polygons: [
      [
        [113, -11],
        [154, -11],
        [153, -39],
        [133, -44],
        [114, -33],
        [113, -11]
      ],
      [
        [166, -34],
        [179, -38],
        [174, -47],
        [166, -45],
        [166, -34]
      ],
      [
        [141, -2],
        [154, -5],
        [151, -10],
        [141, -9],
        [141, -2]
      ],
      [
        [122, -2],
        [131, -3],
        [129, -9],
        [119, -8],
        [122, -2]
      ]
    ]
  },
  {
    id: "antarctica",
    name: "Antarctica",
    sourceContinents: ["Antarctica"],
    polygons: [
      [
        [-180, -61],
        [-130, -66],
        [-70, -65],
        [-15, -68],
        [45, -66],
        [105, -64],
        [180, -62],
        [180, -90],
        [-180, -90],
        [-180, -61]
      ]
    ]
  }
];
