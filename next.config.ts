import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/account",
        destination: "/financetracker/account",
        permanent: false,
      },
      {
        source: "/accounts",
        destination: "/financetracker/accounts",
        permanent: false,
      },
      {
        source: "/categories",
        destination: "/financetracker/categories",
        permanent: false,
      },
      {
        source: "/lending",
        destination: "/financetracker/lending",
        permanent: false,
      },
      {
        source: "/recurring",
        destination: "/financetracker/recurring",
        permanent: false,
      },
      {
        source: "/transactions",
        destination: "/financetracker/transactions",
        permanent: false,
      },
      {
        source: "/transfers",
        destination: "/financetracker/transfers",
        permanent: false,
      },
    ];
  },
};

export default nextConfig;
