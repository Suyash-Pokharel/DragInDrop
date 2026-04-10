import { expect, afterEach, vi } from "vitest";
import { cleanup } from "@testing-library/react";
import * as matchers from "@testing-library/jest-dom/matchers";

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock Next.js Image component
vi.mock("next/image", () => ({
  default: (props: any) => props,
}));

// Mock image imports
vi.mock("@/app/assets/logo/Google.webp", () => ({
  default: "/mocked-google-logo.webp",
}));

vi.mock("@/app/assets/logo/Facebook.webp", () => ({
  default: "/mocked-facebook-logo.webp",
}));

vi.mock("@/app/assets/logo/X.webp", () => ({
  default: "/mocked-x-logo.webp",
}));

vi.mock("@/app/assets/logo/LinkedIn.webp", () => ({
  default: "/mocked-linkedin-logo.webp",
}));

vi.mock("@/app/assets/logo/TikTok.webp", () => ({
  default: "/mocked-tiktok-logo.webp",
}));
