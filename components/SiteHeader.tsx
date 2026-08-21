"use client";

import { useState } from "react";
import Navbar from "@/components/Navbar";
import Sidebar from "@/components/Sidebar";

export default function SiteHeader() {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  return (
    <>
      <Navbar onMenuClick={() => setIsMenuOpen(true)} />
      <Sidebar isOpen={isMenuOpen} onClose={() => setIsMenuOpen(false)} />
    </>
  );
}
