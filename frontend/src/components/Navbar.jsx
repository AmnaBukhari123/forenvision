import { Link } from "react-router-dom";

export default function Navbar() {
  return (
    <nav className="flex justify-between items-center p-4 bg-gray-900 text-white shadow-md">
      <h1 className="text-2xl font-bold">🔍 ForenVision</h1>
      <div className="space-x-4">
        <Link to="/login" className="px-4 py-2 bg-teal-500 rounded-lg hover:bg-teal-400">
          Login
        </Link>
        <Link to="/signup" className="px-4 py-2 bg-gray-700 rounded-lg hover:bg-gray-600">
          Sign Up
        </Link>
      </div>
    </nav>
  );
}
