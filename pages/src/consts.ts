//export const apiRoot =
//  process.env.NODE_ENV === "production"
//    ? "https://api.nanobase.org/api/v1"
//    : "http://localhost:3002/api/v1";
export const apiRoot = "http://localhost:3002/api/v1";

export type status_item = {
  node_id: string;
  node_name: string;
  gpu: {
    total: number;
    left: number;
  };
  cpu: {
    total: number;
    left: number;
  };
  ram: {
    total: number;
    left: number;
  };
};

export const status_giver = (): status_item[] => {
  return [
    {
      node_id: "node-001",
      node_name: "Pronghorn",
      gpu: {
        total: 16,
        left: 8.5,
      },
      cpu: {
        total: 32,
        left: 12,
      },
      ram: {
        total: 64,
        left: 12,
      },
    },
    {
      node_id: "node-002",
      node_name: "Ringtail",
      gpu: {
        total: 32,
        left: 16.2,
      },
      cpu: {
        total: 64,
        left: 12,
      },
      ram: {
        total: 128,
        left: 64,
      },
    },
    {
      node_id: "node-003",
      node_name: "Leonardo",
      gpu: {
        total: 8,
        left: 2.5,
      },
      cpu: {
        total: 16,
        left: 8,
      },
      ram: {
        total: 32,
        left: 16,
      },
    },
  ];
};
