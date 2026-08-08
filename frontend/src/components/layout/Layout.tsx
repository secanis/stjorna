import { ParentProps } from 'solid-js';
import Sidebar from './Sidebar';
import Header from './Header';

export default function Layout(props: ParentProps) {
  return (
    <div class="flex min-h-screen bg-gray-900">
      <Sidebar />
      <div class="flex-1 flex flex-col">
        <Header />
        <main class="flex-1 p-6">
          {props.children}
        </main>
      </div>
    </div>
  );
}