// Metadata for /signup. It needs its own layout because page.jsx is a client
// component, and client components can't export `metadata`.

export const metadata = {
  title: "Create your account · Noble Veterinary Clinics",
  description: "Set up your Noble Vet Clinics account to book appointments and see your pets' records.",
  // This page is only ever reached from a one-time emailed link. Keeping it
  // out of search results costs nothing and avoids indexing a URL that only
  // makes sense with a token attached.
  robots: { index: false, follow: false },
};

export default function SignupLayout({ children }) {
  return children;
}
