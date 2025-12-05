import { Link } from "react-router-dom";

export default function Hero() {
  return (
    <section className="flex flex-col items-center justify-center text-center px-6 py-20 bg-gray-800 text-white">
      <h2 className="text-4xl font-bold mb-4">Welcome to ForenVision</h2>
      <p className="max-w-2xl mb-6 text-gray-300">
        ForenVision is your all-in-one forensic investigation platform. 
        Manage cases, analyze digital evidence, and visualize reconstructions 
        with a seamless dashboard built for investigators and analysts.
      </p>
      <Link
        to="/signup"
        className="px-6 py-3 bg-teal-500 rounded-lg text-lg font-semibold hover:bg-teal-400"
      >
        Get Started
      </Link>
    </section>
  );
}
