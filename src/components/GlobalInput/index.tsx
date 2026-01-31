import QuickNoteInput from './page';
import { SearchInput } from './search';
import { usePathname } from 'next/navigation';

export default function Index() {
    const pathname = usePathname();
    const isSearchPath = Boolean(
        pathname && (pathname.startsWith('/home/search') || pathname.startsWith('/search'))
    );

    return (
        <div className="flipContainer">{isSearchPath ? <SearchInput /> : <QuickNoteInput />}</div>
    );
}
