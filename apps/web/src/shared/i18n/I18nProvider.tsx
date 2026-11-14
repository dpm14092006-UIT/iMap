import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';

export type Language = 'vi' | 'en';

const STORAGE_KEY = 'imap-language';

/** English translations for user-facing Vietnamese copy. Unlisted strings remain Vietnamese. */
const translations: Record<string, string> = {
  'Bản đồ tương tác Việt Nam': 'Interactive map of Vietnam',
  'Chỉ đường': 'Directions',
  'Nhiều điểm': 'Multi-stop',
  'Giao thông': 'Traffic',
  'Đã lưu': 'Saved',
  'Trợ lý': 'Assistant',
  'Trợ lý địa điểm, yêu cầu đăng nhập': 'Places assistant, sign-in required',
  'Công cụ bản đồ': 'Map tools',
  'Công cụ bản đồ (thanh tab)': 'Map tools (tab bar)',
  'Bản đồ': 'Map',
  'Vệ tinh': 'Satellite',
  'Giao thông trực tiếp': 'Live traffic',
  'Quầng màu quanh sự cố và đoạn tắc trên tuyến':
    'Color overlays around incidents and congested route segments',
  'Sự cố cộng đồng': 'Community incidents',
  'Marker kẹt xe, tai nạn, ngập…': 'Markers for traffic, crashes, flooding…',
  'Địa hình': 'Terrain',
  'Đường đồng mức (chỉ với nền Bản đồ)': 'Contour lines (Map layer only)',
  'Lớp bản đồ': 'Map layers',
  Lớp: 'Layers',
  'Loại bản đồ': 'Map type',
  'Lớp phủ': 'Overlays',
  'Chế độ tối tự động 18:00–06:00': 'Automatic dark mode, 6:00 PM–6:00 AM',
  'Điều khiển bản đồ': 'Map controls',
  'Định vị vị trí hiện tại': 'Locate current position',
  'Phóng to bản đồ': 'Zoom in',
  'Thu nhỏ bản đồ': 'Zoom out',
  'Xem toàn Việt Nam': 'Show all of Vietnam',
  'Tìm địa điểm trên bản đồ': 'Search places on the map',
  'Chọn tuyến {route}': 'Select route {route}',
  'Tìm địa điểm, đường hoặc địa chỉ': 'Search for a place, road, or address',
  'Thông thoáng': 'Free-flowing',
  'Vừa phải': 'Moderate',
  Đông: 'Heavy',
  Tắc: 'Congested',
  Chậm: 'Slow',
  'Hiện chú giải giao thông': 'Show traffic legend',
  'Chú giải giao thông': 'Traffic legend',
  'Màu tuyến theo dữ liệu giao thông VietMap': 'Route colors from VietMap traffic data',
  'Mức độ từ nhanh đến chậm': 'Traffic levels from fastest to slowest',
  'Thu gọn chú giải': 'Collapse legend',
  'Tắt lớp giao thông trực tiếp': 'Turn off live traffic layer',
  'Cập nhật': 'Update',
  'Thông tin bản đồ': 'Map information',
  'Đăng nhập tài khoản': 'Sign in',
  English: 'English',
  'Tiếng Việt': 'Vietnamese',
  'Ngôn ngữ': 'Language',
  'Ăn uống': 'Food & drink',
  'Khám phá': 'Explore',
  'Cập nhật kết quả khi di chuyển bản đồ': 'Update results when the map moves',
  'Thử lại': 'Try again',
  'Nguồn: VietMap': 'Source: VietMap',
  'Đang tìm…': 'Searching…',
  'Chưa có tuyến để tìm dọc đường. Hãy tính tuyến ở bảng Chỉ đường.':
    'There is no route to search along yet. Calculate a route in Directions first.',
  'Thử mở rộng bán kính hoặc đổi từ khóa.': 'Try expanding the radius or changing your search term.',
  'Ngay trên đường đi': 'On the route',
  'Chỉ đường đến đây': 'Directions here',
  'Thêm điểm dừng': 'Add stop',
  Lưu: 'Save',
  'Tất cả': 'All',
  'Tên đường': 'Road name',
  'Gợi ý địa điểm': 'Place suggestions',
  'Tìm tên đường, bỏ số nhà': 'Search by road name, excluding house number',
  'Đang tìm địa điểm…': 'Searching for places…',
  'Không lấy được tọa độ địa điểm.': 'Could not get the place coordinates.',
  'Không kết nối được dịch vụ tìm kiếm. Thử lại hoặc chọn trên bản đồ.':
    'Could not connect to the search service. Try again or choose a point on the map.',
  'Chưa tìm thấy địa chỉ phù hợp. Thử thêm phường, tỉnh/thành hoặc chọn điểm trên bản đồ.':
    'No matching address found. Add a ward or city, or choose a point on the map.',
  'Đang lấy tọa độ địa điểm…': 'Getting place coordinates…',
  'Đang tìm thêm…': 'Searching for more…',
  'VietMap · ưu tiên gần khu vực tìm kiếm': 'VietMap · prioritizing the search area',
  'Địa điểm gợi ý có sẵn': 'Suggested place',
  'Địa điểm': 'Place',
  'Chi tiết địa điểm': 'Place details',
  'Điểm chọn trên bản đồ': 'Point selected on the map',
  'Vị trí GPS của thiết bị': 'Device GPS location',
  'Tìm thấy qua VietMap': 'Found with VietMap',
  'Tìm thấy qua Photon / OpenStreetMap': 'Found with Photon / OpenStreetMap',
  'Tuyến đường đã lưu': 'Saved routes',
  'Hành trình của bạn': 'Your trips',
  'Được lưu an toàn trên trình duyệt này': 'Saved securely in this browser',
  'Chưa có tuyến đã lưu': 'No saved routes yet',
  'Tìm đường hoặc tối ưu hành trình nhiều điểm, sau đó nhấn “Lưu”.':
    'Find a route or optimize a multi-stop trip, then select “Save”.',
  'Tuyến đường': 'Route',
  'Xem tuyến': 'View route',
  'CÁ NHÂN': 'PERSONAL',
  'Tuyến được lưu trên trình duyệt này. Khi mở lại, ứng dụng sẽ tính tuyến mới qua VietMap.':
    'Routes are saved in this browser. When reopened, the app calculates a fresh route with VietMap.',
  'ĐANG MỞ': 'OPENING',
  'Đang mở trang đăng nhập…': 'Opening sign-in…',
  'Mỗi hành trình, một kết nối.': 'Every journey brings us together.',
  'Đi đâu tiếp theo?': 'Where to next?',
  'Tìm đường, lưu hành trình và cập nhật giao thông cùng cộng đồng iMap.':
    'Find routes, save trips, and share traffic updates with the iMap community.',
  'Đăng nhập · iMap': 'Sign in · iMap',
  'Về bản đồ': 'Back to map',
  'Khám phá bản đồ trước': 'Explore the map first',
  'Cùng bạn trên mọi tuyến đường': 'With you on every route',
  'Đang tải…': 'Loading…',
  Đóng: 'Close',
  'Quay lại': 'Back',
  'Đóng bảng': 'Close panel',
  'Chưa có địa điểm phù hợp.': 'No matching places found.',
  'Chọn điểm đi và điểm đến.': 'Choose an origin and destination.',
  'Điểm đi và điểm đến đang trùng nhau.': 'The origin and destination are the same.',
  'Hãy chọn điểm đi và điểm đến.': 'Choose an origin and destination.',
  'Hãy chọn địa điểm cho tất cả điểm dừng hoặc xóa ô còn trống.':
    'Choose a place for every stop or remove the empty fields.',
  'Đi ngay': 'Leave now',
  'Khởi hành lúc': 'Depart at',
  'Đến lúc': 'Arrive by',
  'Thời điểm khởi hành': 'Departure time',
  Giờ: 'Time',
  'Chỉ để ước tính giờ đến, chưa dự báo tắc đường theo giờ.':
    'Used only to estimate arrival time; traffic by time of day is not forecast.',
  'Ngắn nhất': 'Shortest',
  'Nhanh nhất': 'Fastest',
  Thật: 'Live GPS',
  'ĐANG TÌM GPS': 'ACQUIRING GPS',
  'ĐANG DẪN ĐƯỜNG': 'NAVIGATING',
  'ĐÃ ĐẾN NƠI': 'ARRIVED',
  'MẤT TÍN HIỆU GPS': 'GPS SIGNAL LOST',
  'Chưa có quyền GPS. Hãy cho phép định vị rồi thử lại.':
    'GPS permission is unavailable. Allow location access and try again.',
  'GPS đang bắt tín hiệu. Đang tiếp tục tìm vị trí…':
    'GPS is acquiring a signal. Still looking for your location…',
  'Tín hiệu GPS tạm thời không ổn định.': 'The GPS signal is temporarily unstable.',
  'Thiết bị này không hỗ trợ định vị GPS.': 'This device does not support GPS location.',
  'Tiếp tục theo tuyến đường': 'Continue along the route',
  'Điều hướng chuyến đi': 'Trip navigation',
  'ĐANG LỆCH KHỎI TUYẾN': 'OFF ROUTE',
  'Bạn đang rời khỏi lộ trình': 'You are off route',
  'Chuyến đi đã hoàn tất': 'Trip complete',
  'Đang lấy vị trí GPS…': 'Getting GPS location…',
  'Thực hiện chỉ dẫn tiếp theo': 'Follow the next instruction',
  'GPS giả lập (demo)': 'Simulated GPS (demo)',
  'GPS trực tiếp': 'Live GPS',
  'Vị trí GPS đang cách xa tuyến. Tính lại từ vị trí hiện tại để tiếp tục.':
    'Your GPS location is far from the route. Recalculate from your current position to continue.',
  'Nguồn vị trí': 'Location source',
  'Chế độ dẫn đường': 'Navigation mode',
  '▶ Tiếp tục': '▶ Resume',
  '⏸ Tạm dừng': '⏸ Pause',
  '↪ Rẽ nhầm': '↪ Simulate wrong turn',
  '⚠ Sự cố phía trước': '⚠ Incident ahead',
  'Đang tính lại…': 'Recalculating…',
  'Tính lại tuyến': 'Recalculate route',
  'Thử lại GPS': 'Retry GPS',
  'Về vị trí': 'Recenter',
  'Toàn tuyến': 'Overview',
  'Báo cáo': 'Report',
  'Kết thúc': 'End',
  'chuyến đi': 'trip',
  'Chỉ dẫn từng bước': 'Turn-by-turn directions',
  'Tiếp tục theo đường': 'Continue on the road',
  'Ước tính': 'Estimate',
  Hủy: 'Cancel',
  'Chạm vào bản đồ để chọn': 'Tap the map to choose',
  'điểm đi': 'origin',
  'điểm đến': 'destination',
  'Đang mở trợ lý…': 'Opening assistant…',
  'Đang mở chỉ đường…': 'Opening directions…',
  'Đang mở giao thông…': 'Opening traffic…',
  'Đang mở tuyến đã lưu…': 'Opening saved routes…',
  'Đang mở tài khoản…': 'Opening account…',
  'Đã lưu hành trình trên thiết bị này': 'Trip saved on this device',
  'Đã xóa hành trình đã lưu': 'Saved trip deleted',
  'Không thể mở lại hành trình này.': 'Could not reopen this trip.',
  'Đã tính lại tuyến đã lưu bằng VietMap': 'Saved route recalculated with VietMap',
  'Đã tính lại hành trình đã lưu bằng VietMap': 'Saved trip recalculated with VietMap',
  'Đã hủy hành trình cũ.': 'Previous trip canceled.',
  'Đã tối ưu thứ tự ghé theo đường đi VietMap': 'Stop order optimized using VietMap routes',
  'Đăng nhập để gửi báo cáo.': 'Sign in to submit a report.',
  'Đăng nhập để xác minh báo cáo.': 'Sign in to verify a report.',
  'Đã đồng bộ báo cáo giao thông': 'Traffic report synced',
  'Tuyến đã thay đổi. Hãy tìm lại điểm dừng.': 'The route has changed. Search for the stop again.',
  'Đã bỏ lưu địa điểm': 'Place removed from saved items',
  'Đang chờ GPS để gắn báo cáo vào vị trí hiện tại.':
    'Waiting for GPS to attach the report to your current location.',
  'Bản đồ nền OpenStreetMap · tuyến đường tính qua API VietMap.':
    'Map tiles by OpenStreetMap · routes calculated with the VietMap API.',
  'Không lấy được vị trí.': 'Could not get your location.',
  'Không tính lại được tuyến.': 'Could not recalculate the route.',
  'Tài khoản iMap': 'iMap account',
  'Sẵn sàng lên đường?': 'Ready to hit the road?',
  'Bắt đầu với iMap.': 'Get started with iMap.',
  'Chào bạn trở lại.': 'Welcome back.',
  'Hành trình tiếp theo đang chờ bạn.': 'Your next trip is waiting.',
  'Tạo tài khoản để chia sẻ và xác nhận giao thông.':
    'Create an account to share and verify traffic reports.',
  'Đăng nhập để tiếp tục hành trình của bạn.': 'Sign in to continue your journey.',
  'Tạo tài khoản thành công. Bạn có thể quay lại bản đồ.': 'Account created. You can return to the map.',
  'Đã gửi yêu cầu tạo tài khoản. Hãy kiểm tra email để xác nhận trước khi đăng nhập.':
    'Sign-up request sent. Check your email to confirm before signing in.',
  'Đăng nhập thành công. Bạn có thể quay lại bản đồ.': 'Signed in. You can return to the map.',
  'Email hoặc mật khẩu chưa đúng. Vui lòng kiểm tra lại.':
    'Email or password is incorrect. Please check and try again.',
  'Hãy xác nhận email trước khi đăng nhập.': 'Confirm your email before signing in.',
  'Không thể xác thực tài khoản lúc này. Vui lòng thử lại.':
    'Could not authenticate your account right now. Please try again.',
  'Đã đăng xuất.': 'Signed out.',
  'Không thể đăng xuất. Vui lòng thử lại.': 'Could not sign out. Please try again.',
  'Đang kiểm tra phiên đăng nhập…': 'Checking sign-in session…',
  'Đăng nhập đang được thiết lập': 'Sign-in is being configured',
  'Bạn vẫn có thể xem bản đồ và tìm đường. Vui lòng quay lại sau để đăng nhập tài khoản.':
    'You can still view the map and find routes. Please come back later to sign in.',
  'Bạn đã đăng nhập': 'You are signed in',
  'Sẵn sàng gửi và xác minh báo cáo giao thông cùng cộng đồng.':
    'You can now submit and verify traffic reports with the community.',
  'Tiếp tục với bản đồ': 'Continue to map',
  'Đang đăng xuất…': 'Signing out…',
  'Đăng xuất': 'Sign out',
  'Chọn phương thức tài khoản': 'Choose account action',
  'Đăng nhập': 'Sign in',
  'Đăng ký': 'Sign up',
  'Mật khẩu': 'Password',
  'Nhập mật khẩu': 'Enter password',
  'Ẩn mật khẩu': 'Hide password',
  'Hiện mật khẩu': 'Show password',
  Ẩn: 'Hide',
  Hiện: 'Show',
  'Dùng ít nhất 8 ký tự. Bạn có thể cần xác nhận qua email.':
    'Use at least 8 characters. You may need to confirm by email.',
  'Đang xử lý…': 'Processing…',
  'Tài khoản của bạn': 'Your account',
  'Mở trang tài khoản': 'Open account page',
  'DÀNH CHO THÀNH VIÊN': 'MEMBERS ONLY',
  'Trợ lý địa điểm': 'Places assistant',
  'ĐỊA ĐIỂM': 'PLACE',
  'TÌM THEO NHU CẦU': 'SEARCH BY NEED',
  'Cách dùng trợ lý': 'How to use the assistant',
  'Chọn thao tác': 'Choose an action',
  'Giọng nói': 'Voice',
  'Chọn loại địa điểm và phạm vi, rồi bấm Tìm. Kết quả lấy từ dữ liệu OpenStreetMap.':
    'Choose a place type and area, then select Search. Results use OpenStreetMap data.',
  'Nói nhu cầu, kiểm tra hoặc sửa câu nhận dạng rồi bấm Tìm. Trợ lý sẽ hỏi lại nếu yêu cầu chưa rõ.':
    'Describe what you need, review or edit the recognized text, then select Search. The assistant will ask follow-up questions if needed.',
  'Phạm vi tìm kiếm': 'Search area',
  'Quanh vị trí chọn': 'Near selected location',
  'Dọc tuyến đang đi': 'Along current route',
  'Dùng tâm bản đồ hiện tại': 'Use current map center',
  'Nhu cầu / câu đã nhận dạng': 'Request / recognized speech',
  'Ví dụ: Tìm trạm xăng trong bán kính 2 km': 'Example: Find a gas station within 2 km',
  'Trình duyệt': 'Browser',
  'Đang nhận dạng…': 'Recognizing…',
  'Xong, nhận dạng': 'Done, transcribe',
  'Dừng nghe': 'Stop listening',
  'Nhập bằng giọng nói': 'Speak your request',
  'Ngôn ngữ giọng nói': 'Speech language',
  'Đang nghe…': 'Listening…',
  'Hủy ghi âm / nhận dạng': 'Cancel recording / transcription',
  'Bạn muốn tìm gì?': 'What are you looking for?',
  'Phạm vi và giới hạn': 'Area and limits',
  'Bộ lọc tùy chọn': 'Optional filters',
  'Loại địa điểm': 'Place type',
  'Hiểu từ yêu cầu': 'Infer from request',
  'Bán kính (km)': 'Radius (km)',
  'Mặc định 2 km': 'Default: 2 km',
  'Đi thêm tối đa (km)': 'Maximum extra distance (km)',
  'Thêm tối đa (phút)': 'Maximum extra time (minutes)',
  'Mặc định 15 phút': 'Default: 15 minutes',
  'Bộ lọc chọn tay được ưu tiên hơn câu nhập.': 'Manually selected filters take priority over your request.',
  'Tìm địa điểm': 'Search places',
  'Hủy tìm kiếm': 'Cancel search',
  'Xóa ngữ cảnh trao đổi': 'Clear conversation context',
  'Xem trên bản đồ': 'View on map',
  'Nguồn OSM': 'OSM source',
  'Ghé điểm này': 'Add this stop',
  'Nguồn dữ liệu và giới hạn': 'Data sources and limitations',
  'Sắp xếp': 'Sort',
  'Bán kính': 'Radius',
  'Bộ lọc': 'Filters',
  'Cuộn danh mục sang trái': 'Scroll categories left',
  'Cuộn danh mục sang phải': 'Scroll categories right',
  'Khám phá quanh đây': 'Explore nearby',
  'Tìm dọc tuyến': 'Search along route',
  'Thông tin tuyến đường': 'Route details',
  'Mức giao thông trên tuyến': 'Traffic along route',
  'Có sự cố giao thông trên tuyến': 'Traffic incident on route',
  'Không thu phí': 'No tolls',
  'Có đoạn đi phà': 'Includes a ferry',
  'Chi tiết': 'Details',
  'Xem trước': 'Preview',
  'Thứ tự bạn nhập không đi được; đã tìm thứ tự hợp lệ':
    'The entered stop order is not feasible; a valid order was found',
  'Tiết kiệm': 'Savings',
  'so với thứ tự bạn': 'compared with your entered order',
  'nhập:': 'entered:',
  'Thứ tự bạn nhập đã là tốt nhất': 'Your entered order is already optimal',
  'Tính theo ma trận chi phí VietMap, có thể lệch nhẹ so với tuyến cuối.':
    'Based on the VietMap cost matrix; the final route may differ slightly.',
  'Bản đồ Việt Nam với tìm kiếm địa điểm và công cụ lập hành trình.':
    'Vietnam map with place search and trip planning tools.',
  'Bản đồ & chỉ đường': 'Maps & directions',
  'iMap cần bật JavaScript để hiển thị bản đồ và chỉ đường.':
    'iMap needs JavaScript enabled to show the map and directions.',
  'Tài khoản': 'Account',
  'Có phiên bản iMap mới. Chọn Cập nhật để tải lại trang.':
    'A new version of iMap is available. Select Update to reload the page.',
  'Có phiên bản mới. Cập nhật iMap': 'New version available. Update iMap',
  'Có phiên bản iMap mới': 'A new version of iMap is available',
  Nhanh: 'Fast',
  'Nhà hàng': 'Restaurant',
  'Cà phê': 'Cafe',
  'Khách sạn': 'Hotel',
  'Điểm tham quan': 'Attractions',
  'Bảo tàng': 'Museum',
  'Trạm xe buýt': 'Bus stop',
  'Nhà thuốc': 'Pharmacy',
  Xăng: 'Fuel',
  'Sạc EV': 'EV charging',
  'dọc tuyến': 'along route',
  'quanh đây': 'nearby',
  'quanh tuyến': 'along the route',
  'Cách tuyến {distance}': '{distance} from route',
  '+{minutes} phút đi vòng': '+{minutes} min detour',
  'Km {distance} trên tuyến': 'Km {distance} along route',
  'Cách {distance}': '{distance} away',
  '{count} kết quả': '{count} results',
  'Không thấy {term} trong {radius} {where}': 'No {term} found within {radius} {where}',
  'Điểm xuất phát': 'Starting point',
  'Điểm dừng {number}': 'Stop {number}',
  'Đưa điểm dừng {number} lên trước': 'Move stop {number} earlier',
  'Đưa điểm dừng {number} xuống sau': 'Move stop {number} later',
  'Xóa điểm dừng {number}': 'Remove stop {number}',
  'Điểm đến': 'Destination',
  'Bạn muốn đi đâu?': 'Where do you want to go?',
  'Đảo chiều điểm đi và điểm đến': 'Swap origin and destination',
  'Đảo chiều': 'Swap',
  'Đang dẫn đường': 'Navigating',
  'Bắt đầu': 'Start',
  'GPS chỉ bật khi bạn nhấn Bắt đầu. Thời gian là ước tính và có thể đổi theo giao thông.':
    'GPS starts only after you select Start. Travel time is an estimate and may change with traffic.',
  'Đang lấy tuyến đường…': 'Getting routes…',
  'Tìm đường': 'Find routes',
  'Lộ trình': 'ROUTE',
  'Lập hành trình nhiều điểm với điểm đi và đến hiện tại':
    'Plan a multi-stop trip with the current origin and destination',
  'Thêm điểm đến': 'Add destination',
  'Đang định vị…': 'Locating…',
  'Vị trí của tôi': 'My location',
  'Chọn điểm đi': 'Choose origin',
  'Chọn điểm đến': 'Choose destination',
  'Đi theo thứ tự trên. Muốn tự sắp xếp tốt nhất, dùng Nhiều điểm.':
    'Stops are visited in the order shown. To optimize the order, use Multi-stop.',
  'Tùy chọn tuyến': 'Route options',
  'Tùy chọn': 'Options',
  'Ưu tiên tuyến': 'Route preference',
  'Tiêu chí tìm tuyến': 'Route preference',
  'Tránh phà': 'Avoid ferries',
  'VietMap hiện chưa hỗ trợ loại trừ cao tốc trong API tuyến đang dùng.':
    'The current VietMap routing API does not support avoiding highways.',
  'Tránh cao tốc: chưa hỗ trợ': 'Avoid highways: not supported',
  'Các tuyến có thể đi': 'Available routes',
  '{count} phương án': '{count} options',
  'Tuyến VietMap theo phương tiện và tùy chọn đã chọn. Thời gian là ước tính.':
    'Routes are calculated by VietMap using your selected vehicle and preferences. Travel time is an estimate.',
  'Phương tiện': 'Vehicle',
  'Xe máy': 'Motorcycle',
  'Ô tô': 'Car',
  'Chọn phương tiện nhanh nhất: {vehicle}': 'Select the fastest vehicle: {vehicle}',
  'Tính tuyến cho cả xe máy và ô tô để biết phương tiện nhanh nhất':
    'Calculate routes for both motorcycles and cars to see which is fastest',
  'Tốt nhất': 'Best',
  'Nên khởi hành lúc {time}': 'Suggested departure: {time}',
  'Dự kiến đến lúc {time}': 'Estimated arrival: {time}',
  'Mức giao thông trên tuyến: {levels}': 'Traffic along route: {levels}',
  '+{minutes} phút': '+{minutes} min',
  'qua {street}': 'via {street}',
  'Kẹt xe {length}': 'Congestion {length}',
  'Có thu phí ~{amount} ₫': 'Toll ~₫{amount}',
  'Đã sao chép liên kết': 'Link copied',
  'Không tự sao chép được. Hãy chọn liên kết và nhấn Ctrl+C.':
    'Could not copy automatically. Select the link and press Ctrl+C.',
  'Chia sẻ tuyến': 'Share route',
  'Gửi tới điện thoại': 'Send to phone',
  'Mở tuyến này trên điện thoại': 'Open this route on your phone',
  'Sao chép liên kết dưới đây rồi gửi cho chính bạn qua Zalo, Messenger hoặc email, sau đó mở trên điện thoại.':
    'Copy the link below, send it to yourself via Zalo, Messenger, or email, then open it on your phone.',
  'Liên kết tuyến đường': 'Route link',
  'Sao chép liên kết': 'Copy link',
  'Chia sẻ': 'Share',
  'Đã định vị · sai số khoảng {meters} m': 'Located · accuracy about {meters} m',
  'Cảnh báo tuyến: {incident} mức {severity}. Đã cập nhật đoạn đường.':
    'Route alert: {incident} is {severity}. The route segment has been updated.',
  nhẹ: 'low',
  vừa: 'moderate',
  nặng: 'high',
  'Đã chuyển sang tuyến thay thế để tránh sự cố': 'Switched to an alternative route to avoid the incident',
  'Đã tính lại tuyến từ vị trí hiện tại': 'Route recalculated from your current location',
  'Đã đi vòng để tránh sự cố': 'Detoured to avoid the incident',
  'Không tìm được đường tránh sự cố, hãy chú ý':
    'No route could avoid the incident. Please proceed carefully.',
  'Đường đóng (demo)': 'Road closed (demo)',
  'Đã gửi báo cáo; Supabase chưa cập nhật phân luồng, cảnh báo tạm áp dụng cho cả ô tô và xe máy.':
    'Report submitted. Supabase has not updated vehicle routing yet, so this alert temporarily applies to both cars and motorcycles.',
  'Đã thêm điểm ghé: {name}': 'Added stop: {name}',
  'Đang khám phá quanh TP.HCM. Hãy phóng to bản đồ tới khu vực bạn muốn.':
    'Exploring near Ho Chi Minh City. Zoom in to the area you want to search.',
  'Đã thêm điểm dừng: {name}': 'Added stop: {name}',
  'Đã lưu {name}': 'Saved {name}',
  'Tìm {what} {where}': 'Find {what} {where}',
  'Chạm vào bản đồ để chọn {target}': 'Tap the map to choose a {target}',
  'Trong {distance}': 'In {distance}',
  'Còn {distance}': '{distance} remaining',
  'Tuyến khác': 'Alternative route',
  'Tránh trạm thu phí': 'Avoid tolls',
  'Kẹt xe': 'Congestion',
  'Chọn thời gian khởi hành': 'Choose departure time',
  'Chưa có kết quả phù hợp.': 'No matching results.',
  'Tìm thấy {count} địa điểm': 'Found {count} places',
  'Chạm vào bản đồ để chọn điểm đi': 'Tap the map to choose an origin',
  'Chạm vào bản đồ để chọn điểm đến': 'Tap the map to choose a destination',
  'Đi thẳng': 'Continue straight',
  'Rẽ trái': 'Turn left',
  'Rẽ phải': 'Turn right',
  'Rẽ nhẹ trái': 'Bear left',
  'Rẽ nhẹ phải': 'Bear right',
  'Quay đầu': 'Make a U-turn',
  'Đến nơi': 'You have arrived',
  'Rẽ gắt trái': 'Turn sharply left',
  'Rẽ gắt phải': 'Turn sharply right',
  'Giữ làn trái': 'Keep left',
  'Giữ làn phải': 'Keep right',
  'Qua điểm dừng': 'Pass the stop',
  'Vào vòng xuyến': 'Enter the roundabout',
  'Đi vào đường': 'Enter the road',
  'Đi ra đường': 'Exit the road',
  'Xuất phát': 'Start',
  'Chờ GPS': 'Waiting for GPS',
  'Các tuyến': 'Routes',
  'Đang cập nhật…': 'Updating…',
  'Báo cáo giao thông': 'Traffic report',
  'Cảnh báo giao thông': 'Traffic alert',
  'Không thể tải dữ liệu.': 'Could not load data.',
  'Khu vực này': 'This area',
  'Thời tiết minh họa': 'Illustrative weather',
  'Nhiệt độ': 'Temperature',
  'Cách tuyến {distance} · {detour}': '{distance} from route · {detour}',
  'đi vòng khoảng {minutes} phút': 'about {minutes} min detour',
  'ngay trên đường đi': 'right on the route',
  'Cách tâm tìm kiếm {distance}': '{distance} from search center',
  'Tọa độ': 'Coordinates',
  'Mở địa điểm trên OpenStreetMap': 'Open place in OpenStreetMap',
  'Tìm đường đến đây': 'Directions here',
  'Nguồn địa điểm được ghi rõ theo từng kết quả ở trên.': 'The source is listed for each result above.',
  'Ước tính: Giao thông thông thoáng': 'Estimated: Free-flowing traffic',
  'Ước tính: Giao thông vừa phải': 'Estimated: Moderate traffic',
  'Ước tính: Giao thông đông đúc': 'Estimated: Heavy traffic',
  Nắng: 'Sunny',
  'Nhiều mây': 'Cloudy',
  'Mưa rào': 'Showers',
  'Trời quang': 'Clear',
  'Mở rộng thẻ Khu vực này (thời tiết minh họa, giao thông ước tính)':
    'Expand this area card (illustrative weather, estimated traffic)',
  'Thu gọn thẻ Khu vực này': 'Collapse this area card',
  'Mức giao thông là ước tính từ giờ cao điểm và báo cáo cộng đồng, không phải dữ liệu thời gian thực':
    'Traffic is estimated from rush hours and community reports, not live data',
  'Thời tiết minh họa: {weather}': 'Illustrative weather: {weather}',
  'Có thể chậm hơn ~{minutes} phút': 'May be ~{minutes} min slower',
  'Chưa thấy dấu hiệu chậm hơn': 'No signs of slower traffic',
  '{count} sự cố đang báo': '{count} reported incidents',
  'Chưa có sự cố': 'No incidents reported',
  'Mở bảng Giao thông': 'Open Traffic',
  'Thời tiết minh họa · Giao thông ước tính từ giờ cao điểm và báo cáo cộng đồng':
    'Illustrative weather · Traffic estimated from rush hours and community reports',
  'Khu vực này: {temperature} độ (thời tiết minh họa), {traffic} (ước tính từ giờ cao điểm và báo cáo cộng đồng). Mở bảng Giao thông':
    'This area: {temperature} degrees (illustrative weather), {traffic} (estimated from rush hours and community reports). Open Traffic',
  'Theo tuyến': 'Along route',
  'Gần nhất': 'Nearest',
  'Ít đi vòng nhất': 'Shortest detour',
  'Sắp xếp: {sort}': 'Sort: {sort}',
  'Sắp xếp theo': 'Sort by',
  'Bán kính: {radius}': 'Radius: {radius}',
  'Bán kính tìm kiếm': 'Search radius',
  'Loại tìm kiếm': 'Search type',
  'CỘNG ĐỒNG': 'COMMUNITY',
  'Tình hình giao thông': 'Traffic conditions',
  'Cảnh báo cộng đồng': 'Community alerts',
  'Tự hết hạn': 'Expire automatically',
  'Báo cáo sự cố': 'Report an incident',
  'Chạm bản đồ để chọn vị trí': 'Tap the map to choose a location',
  'Mức độ sự cố · chọn thủ công': 'Incident severity · choose manually',
  'Áp dụng cho loại xe': 'Applies to vehicle type',
  'Loại xe áp dụng báo cáo': 'Vehicle type for report',
  'Ghi chú ngắn': 'Short note',
  'không bắt buộc': 'optional',
  'Ví dụ: ngập sâu gần giao lộ…': 'Example: deep flooding near the intersection…',
  'Ảnh hiện trường': 'Incident photo',
  'Tối đa 5 MB': '5 MB maximum',
  'Chụp ảnh': 'Take photo',
  'Chọn ảnh': 'Choose photo',
  'Trên điện thoại, nút Chụp ảnh sẽ mở camera. Ảnh chỉ được lưu cùng báo cáo khi bạn bấm Gửi báo cáo.':
    'On phones, Take photo opens the camera. The image is only attached when you submit the report.',
  'Xem trước ảnh hiện trường': 'Preview incident photo',
  'Xóa ảnh đã chọn': 'Remove selected photo',
  'Hỗ trợ từ AI': 'AI assistance',
  'tùy chọn': 'optional',
  'Gợi ý loại sự cố': 'Suggest incident type',
  'Đang phân tích…': 'Analyzing…',
  'Đang nhận diện…': 'Recognizing…',
  'Nhận diện biển báo': 'Read traffic sign',
  'Ảnh chỉ được gửi đến Google Gemini khi bạn bấm một nút trên. Với gói miễn phí, Google có thể dùng nội dung để cải thiện dịch vụ và người đánh giá có thể xem. Tránh ảnh có khuôn mặt hoặc biển số.':
    'Images are only sent to Google Gemini when you select one of the buttons above. On the free plan, Google may use content to improve its services and human reviewers may see it. Avoid images with faces or license plates.',
  'Đang kiểm tra cấu hình Gemini…': 'Checking Gemini configuration…',
  'AI ảnh chưa bật trên backend. Cần GEMINI_TRAFFIC_AI_ENABLED=true và GEMINI_API_KEY.':
    'Image AI is not enabled on the backend. GEMINI_TRAFFIC_AI_ENABLED=true and GEMINI_API_KEY are required.',
  'Đang phân tích ảnh…': 'Analyzing image…',
  'Gợi ý sự cố': 'Incident suggestion',
  'Tin cậy: {confidence}': 'Confidence: {confidence}',
  'Quan sát: {details}': 'Observations: {details}',
  'Ảnh chưa đủ căn cứ để xác định sự cố giao thông.':
    'The image does not provide enough evidence to identify a traffic incident.',
  'AI chỉ gợi ý loại sự cố và ghi chú. Mức độ do bạn tự chọn.':
    'AI only suggests the incident type and note. You choose the severity.',
  'Dùng gợi ý để điền form': 'Use suggestion to fill the form',
  'Chưa nhận diện được biển báo rõ ràng': 'Could not clearly identify a traffic sign',
  'Chữ/số nhìn thấy: {text}': 'Visible text/numbers: {text}',
  'Chỉ là gợi ý hình ảnh; hiệu lực còn phụ thuộc chiều đường và biển phụ. Không tự thay đổi tuyến đường.':
    'This is only an image suggestion; applicability depends on travel direction and supplementary signs. It will not change your route automatically.',
  'Đang gửi…': 'Submitting…',
  'Gửi báo cáo': 'Submit report',
  'Đăng nhập để gửi báo cáo': 'Sign in to submit a report',
  'Chọn đúng vị trí trên bản đồ trước khi gửi.': 'Choose the correct location on the map before submitting.',
  'Báo cáo gần đây': 'Recent reports',
  'Đang đồng bộ báo cáo…': 'Syncing reports…',
  '{count} báo cáo trong 30 phút / 75 m · {reporters} người gửi riêng biệt':
    '{count} reports in 30 min / 75 m · {reporters} distinct reporters',
  'cập nhật': 'updated',
  'chưa có xác nhận mới': 'no recent confirmation',
  'Mở ảnh minh chứng': 'Open evidence photo',
  'Ảnh minh chứng: {incident}': 'Evidence photo: {incident}',
  'Có ảnh minh chứng': 'Evidence photo attached',
  'Đã thông': 'Cleared',
  'Vẫn còn': 'Still active',
  'Chưa có báo cáo trong khu vực này. Hãy chọn vị trí và gửi cập nhật đầu tiên.':
    'No reports in this area yet. Choose a location and submit the first update.',
  'Báo cáo được đồng bộ qua Supabase và tự ẩn khi hết hạn. Hãy tự xác minh tình hình trước khi di chuyển.':
    'Reports sync through Supabase and disappear when they expire. Verify conditions before traveling.',
  'Bắt đầu chuyến đi': 'Start trip',
  'Chọn các điểm cần ghé. Tự sắp xếp thứ tự tốt nhất theo thời gian hoặc quãng đường, giữ cố định điểm xuất phát.':
    'Choose your stops. Automatically find the best order by time or distance while keeping the starting point fixed.',
  'Chọn điểm xuất phát': 'Choose a starting point',
  'Danh sách điểm dừng': 'Stop list',
  'Tối đa {count} điểm cần ghé.': 'You can add up to {count} stops.',
  'Điểm này đã có trong hành trình.': 'This place is already in the trip.',
  'Điểm xuất phát trùng một điểm cần ghé.': 'The starting point matches one of the stops.',
  'Hãy chọn điểm xuất phát từ gợi ý.': 'Choose a starting point from the suggestions.',
  'Không tính được hành trình. Hãy thử lại.': 'Could not calculate the trip. Please try again.',
  'LẬP KẾ HOẠCH': 'TRIP PLANNER',
  'Hành trình nhiều điểm': 'Multi-stop trip',
  'Xóa hành trình': 'Clear trip',
  'Điểm xuất phát hành trình nhiều điểm': 'Multi-stop trip starting point',
  'Ưu tiên': 'Preference',
  'Thời gian': 'Time',
  'Quay lại điểm xuất phát': 'Return to starting point',
  'Điểm cần ghé': 'Stops',
  'Xóa {name}': 'Remove {name}',
  'Tìm điểm dừng để thêm': 'Search for a stop to add',
  'Đang tối ưu đường đi…': 'Optimizing route…',
  'Tối ưu hành trình': 'Optimize trip',
  'Đã sắp xếp hành trình': 'Trip order optimized',
  '{minutes} phút': '{minutes} minutes',
  'Tối ưu theo chi phí đường bộ VietMap, có xét chiều di chuyển. Để đi theo thứ tự tự chọn, dùng mục Chỉ đường.':
    'Optimized using VietMap road costs and travel direction. To keep your own stop order, use Directions.',
  'Thứ tự bạn nhập không đi được; đã tìm thứ tự hợp lệ ({cost}).':
    'Your entered order was not feasible; a valid order was found ({cost}).',
  'Tiết kiệm ': 'Savings: ',
  'so với thứ tự bạn nhập: {original} → {optimized}.':
    'compared with your entered order: {original} → {optimized}.',
  'Thứ tự bạn nhập đã là tốt nhất ({cost}).': 'Your entered order is already optimal ({cost}).',
  Xóa: 'Remove',
  'Đang kiểm tra tài khoản…': 'Checking account…',
  'Đăng nhập để dùng trợ lý AI': 'Sign in to use the AI assistant',
  'Tạo tài khoản và đăng nhập để mở các tính năng dành cho thành viên.':
    'Create an account and sign in to unlock member features.',
  'Tìm địa điểm theo nhu cầu bằng AI': 'Find places by describing what you need with AI',
  'Gợi ý điểm dừng dọc tuyến đang đi': 'Get stop suggestions along your route',
  'Tìm kiếm bằng giọng nói': 'Search by voice',
  'Đăng nhập / Đăng ký': 'Sign in / Sign up',
  'Bạn vẫn có thể xem bản đồ, tìm địa chỉ và chỉ đường mà không cần tài khoản.':
    'You can still view the map, search addresses, and get directions without an account.',
  'Minh họa hành trình': 'Trip illustration',
  'iMap — về bản đồ': 'iMap — back to map',
  'iMap · Cùng bạn trên mọi tuyến đường': 'iMap · With you on every route',
  'TÀI KHOẢN': 'ACCOUNT',
  'Đã có lỗi xảy ra': 'Something went wrong',
  'Ứng dụng gặp sự cố khi hiển thị. Tải lại trang để tiếp tục; các tuyến đã lưu của bạn vẫn còn.':
    'The app had trouble displaying this page. Reload to continue; your saved routes are still available.',
  'Tải lại trang': 'Reload page',
  'Tự động': 'Automatic',
  'Tai nạn': 'Crash',
  Ngập: 'Flooding',
  'Đường đóng': 'Road closure',
  'Chướng ngại vật': 'Road hazard',
  'Thi công': 'Roadworks',
  'Sự cố giao thông': 'Traffic incident',
  'Lớp giao thông': 'Traffic layer',
  'Trên tuyến': 'On route',
  'Đã lưu an toàn trên trình duyệt này': 'Saved securely in this browser',
  'Điện thoại': 'Phone',
  'Địa điểm gợi ý': 'Suggested place',
  'Nổi bật': 'Recommended',
  'Gần vị trí tìm kiếm': 'Near search center',
  'Trạm xăng': 'Gas station',
  'Tạo tài khoản': 'Create account',
  'Ô tô + xe máy': 'Cars + motorcycles',
  'Đã gửi báo cáo. Cảm ơn bạn đã cập nhật tình hình.': 'Report submitted. Thank you for sharing an update.',
  'Đã điền loại sự cố và ghi chú. Mức độ vẫn theo lựa chọn thủ công của bạn.':
    'Incident type and note filled in. Severity remains as you selected.',
  'Đăng nhập để dùng phân tích ảnh.': 'Sign in to use image analysis.',
  'Ảnh phải có định dạng JPG, PNG hoặc WebP.': 'Images must be JPG, PNG, or WebP.',
  'Ảnh tối đa 5 MB.': 'Images must be 5 MB or smaller.',
  'AI chưa bật. Bạn vẫn có thể nói hoặc nhập nhu cầu đơn giản; trợ lý đang hiểu bằng từ khóa.':
    'AI is unavailable. You can still speak or type a simple request; the assistant will use keyword matching.',
  'AI hiểu yêu cầu': 'AI understood the request',
  'Bỏ điểm dừng để tìm lại': 'Remove the stop and search again',
  'Chưa có kết quả trong phạm vi dữ liệu khảo sát. Thử đổi vị trí hoặc bán kính.':
    'No results in the surveyed area. Try changing the location or search radius.',
  'Chưa tìm thấy điểm đáp ứng giới hạn trong phạm vi khảo sát.':
    'No places in the surveyed area match these limits.',
  'Chưa xác nhận được trạng thái AI. Nguồn xử lý sẽ hiển thị cùng kết quả.':
    'Could not confirm AI availability. The processing source will be shown with the results.',
  'Chỉ nghe khi bạn bấm nút. Trình duyệt có thể gửi âm thanh đến dịch vụ nhận giọng nói. Kiểm tra chữ rồi bấm Tìm; không tự gửi.':
    'Listening starts only when you select the button. Your browser may send audio to a speech recognition service. Review the text and select Search; nothing is submitted automatically.',
  'Cách vị trí chọn khoảng {distance} km đường thẳng.':
    'About {distance} km in a straight line from the selected location.',
  'Cần một tuyến hai điểm để tính đường đi thêm. Bạn vẫn có thể hỏi hoặc chuyển sang tìm quanh vị trí.':
    'A route with an origin and destination is needed to calculate detour distance. You can still ask a question or search near a location.',
  'Dịch vụ giọng nói': 'Speech service',
  'Ghi tối đa 15 giây; âm thanh gửi qua máy chủ đến Cloudflare Whisper. Bấm Xong để nhận dạng, kiểm tra chữ rồi bấm Tìm.':
    'Record up to 15 seconds. Audio is sent through the server to Cloudflare Whisper. Select Done to transcribe, review the text, then select Search.',
  'Hãy chọn loại địa điểm bạn muốn tìm.': 'Choose the type of place you want to find.',
  'Hãy nhập nhu cầu hoặc chọn một loại địa điểm.': 'Enter what you need or choose a place type.',
  'Không tìm được địa điểm.': 'Could not find places.',
  'Kết quả đã quá 2 phút. Hãy tìm lại.': 'These results are over two minutes old. Search again.',
  'Trình duyệt này chưa hỗ trợ giọng nói. Bạn vẫn có thể nhập chữ tiếng Anh hoặc Việt.':
    'This browser does not support speech recognition. You can still type in English or Vietnamese.',
  'Tìm quanh: {lat}, {lng}. Bấm bản đồ để đổi vị trí.':
    'Search near {lat}, {lng}. Select the map to change the location.',
  'Whisper API (chưa cấu hình)': 'Whisper API (not configured)',
  '{category} · bán kính {radius} km · khoảng cách đường thẳng.':
    '{category} · {radius} km radius · straight-line distance.',
  '{category} · tối đa {distance} km và {duration} phút đi thêm.':
    '{category} · up to {distance} km and {duration} minutes extra travel.',
  '{origin} → {destination}. So sánh với tuyến không ghé.':
    '{origin} → {destination}. Compared with the route without this stop.',
  'Đang dùng bộ lọc ngôn ngữ; chưa có kết quả từ AI': 'Using keyword filters; no AI results yet',
  'Đã cấu hình AI hiểu nhu cầu. Nếu dịch vụ lỗi, trợ lý sẽ thông báo khi dùng từ khóa.':
    'AI request understanding is configured. If the service fails, the assistant will report it and use keyword matching.',
  'Microphone chưa được cấp quyền. Bạn vẫn có thể nhập chữ.':
    'Microphone access was not granted. You can still type.',
  'Chưa nghe rõ câu nói. Hãy thử lại hoặc nhập chữ.': 'Speech was unclear. Try again or type instead.',
  'Không nhận được giọng nói. Hãy thử lại hoặc nhập chữ.':
    'No speech was detected. Try again or type instead.',
  'Trình duyệt chưa khởi động được nhận giọng nói. Bạn có thể nhập chữ.':
    'The browser could not start speech recognition. You can type instead.',
  'Không ghi được âm thanh. Hãy thử lại hoặc nhập chữ.': 'Could not record audio. Try again or type instead.',
  'Voice chưa sẵn sàng.': 'Voice is not ready.',
  'Chưa được cấp quyền micro hoặc không có thiết bị. Kiểm tra quyền micro và dùng HTTPS.':
    'Microphone access was denied or no device is available. Check microphone permissions and use HTTPS.',
  'Hãy nói từ 0,2 đến 15 giây.': 'Speak for 0.2 to 15 seconds.',
  'Bản ghi quá lớn. Hãy nói ngắn hơn.': 'The recording is too large. Speak for less time.',
  '{count} báo cáo trong 30 phút / 75 m từ {reporters} người{freshness}':
    '{count} reports within 75 m over 30 minutes from {reporters} people{freshness}',
  'Ngập đường': 'Flooding',
  'Vật cản': 'Obstacle',
  Nhẹ: 'Low',
  Vừa: 'Moderate',
  Nặng: 'High',
  'Cả hai': 'Both',
  'Chưa rõ': 'Unknown',
  'sự cố giao thông': 'traffic incident',
  'Quãng đường': 'Distance',
  'Công viên': 'Park',
  'Di tích lịch sử': 'Historic site',
  'Khu vực': 'Area',
  'Khu đô thị': 'Urban area',
  'Nút giao': 'Interchange',
  'Phố đi bộ': 'Pedestrian street',
  'Địa điểm nổi bật': 'Landmark',
  'Sân bay': 'Airport',
  'Trường đại học': 'University',
  Chợ: 'Market',
  'Bệnh viện': 'Hospital',
  'Trung tâm thương mại': 'Shopping mall',
  'Bến xe': 'Bus station',
  'Địa chỉ': 'Address',
  'Điểm đã chọn trên bản đồ': 'Selected map point',
  'Điểm trên bản đồ': 'Map point',
  'Vị trí hiện tại': 'Current location',
  'Chưa cấu hình Supabase Auth.': 'Supabase Auth is not configured.',
  'Địa điểm chưa có tọa độ. Hãy chọn kết quả khác.': 'This place has no coordinates. Choose another result.',
  'Dịch vụ lấy tọa độ chưa sẵn sàng.': 'The place lookup service is unavailable.',
  'VietMap trả về dữ liệu địa điểm không hợp lệ.': 'VietMap returned invalid place data.',
  'Không kết nối được VietMap Search. Hãy thử lại.': 'Could not connect to VietMap Search. Try again.',
  'Máy chủ phản hồi quá lâu. Hãy thử lại.': 'The server took too long to respond. Try again.',
  'Không kết nối được máy chủ. Kiểm tra mạng rồi thử lại.':
    'Could not connect to the server. Check your connection and try again.',
  'Bạn thao tác quá nhanh, hãy thử lại sau ít giây.':
    'You are doing that too quickly. Try again in a few seconds.',
  'Bạn thao tác quá nhanh, thử lại sau {seconds} giây.':
    'You are doing that too quickly. Try again in {seconds} seconds.',
  'Lỗi API ({status})': 'API error ({status})',
  'Phản hồi API không hợp lệ': 'Invalid API response',
  'Đường đi rỗng.': 'The route is empty.',
  'Thứ tự tối ưu trả về không hợp lệ.': 'The optimized stop order is invalid.',
  'Không kết nối được dịch vụ tối ưu hành trình. Hãy thử lại.':
    'Could not connect to the trip optimization service. Try again.',
  'Chọn ít nhất điểm đi và điểm đến.': 'Choose at least an origin and destination.',
  'Dịch vụ chỉ đường trả về tuyến không hợp lệ.': 'The directions service returned an invalid route.',
  'Không kết nối được máy chủ chỉ đường. Hãy thử lại sau ít phút.':
    'Could not connect to the directions server. Try again in a few minutes.',
  'Phóng to khu vực cần xem để tải báo cáo giao thông.': 'Zoom in on an area to load traffic reports.',
  'Không kết nối được máy chủ giao thông.': 'Could not connect to the traffic server.',
  'Máy chủ chưa cấu hình khóa VietMap nên chưa tìm được địa điểm.':
    'The VietMap key is not configured on the server, so places cannot be searched.',
  'Khóa VietMap chưa được cấp quyền tìm địa điểm.': 'The VietMap key is not authorized to search for places.',
  'VietMap đã hết hạn mức tìm địa điểm. Hãy thử lại sau.':
    'The VietMap place search quota has been reached. Try again later.',
  'VietMap đang bận. Hãy thử lại sau ít phút.': 'VietMap is busy. Try again in a few minutes.',
  'VietMap trả về dữ liệu không hợp lệ. Hãy thử lại.': 'VietMap returned invalid data. Try again.',
  'Đang có nhiều lượt tìm cùng lúc. Hãy thử lại sau vài giây.':
    'There are many searches at once. Try again in a few seconds.',
  'Yêu cầu tìm kiếm không hợp lệ. Hãy đổi từ khóa hoặc bán kính.':
    'The search request is invalid. Change the search term or radius.',
  'Không tải được danh sách địa điểm. Hãy thử lại.': 'Could not load places. Try again.',
  'Đăng nhập để gửi báo cáo giao thông.': 'Sign in to submit a traffic report.',
  'Không xác định được tài khoản để lưu ảnh.': 'Could not identify the account to save the image.',
  'Đăng nhập để xác minh báo cáo giao thông.': 'Sign in to verify a traffic report.',
  'Cần cấu hình Supabase để đính kèm ảnh.': 'Supabase must be configured to attach an image.',
  'Ảnh phải là JPG, PNG hoặc WebP và không quá 5 MB.':
    'Images must be JPG, PNG, or WebP and no larger than 5 MB.',
  'Không tải được ảnh lên. Kiểm tra kết nối và quyền lưu trữ.':
    'Could not upload the image. Check your connection and storage permissions.',
  'Không thể dọn ảnh chưa gắn với báo cáo.': 'Could not remove the image that is not attached to a report.',
  'Vui lòng đăng nhập để phân tích ảnh': 'Sign in to analyze an image.',
  'Ảnh phải là JPG, PNG hoặc WebP.': 'Images must be JPG, PNG, or WebP.',
  'Không đọc được ảnh hoặc ảnh vượt quá 5 MB.': 'Could not read the image, or it is larger than 5 MB.',
  'Nội dung ảnh không khớp với định dạng tệp.': 'The image content does not match its file type.',
  'Tìm điểm dừng hiện hỗ trợ tuyến trong đô thị dài tối đa 80 km.':
    'Stop search currently supports urban routes up to 80 km long.',
  'Tuyến trải trên khu vực quá rộng. Hãy chọn một chặng ngắn hơn.':
    'This route covers too large an area. Choose a shorter leg.',
  'Chưa tính được đường đi qua các điểm dừng. Vui lòng thử lại sau.':
    'Could not calculate a route through the stops. Try again later.',
  'Chỉ khảo sát tối đa 4 địa điểm gần hình học tuyến trong bán kính 1,5 km; không bảo đảm tối ưu trên toàn bộ địa điểm.':
    'We check up to four places within 1.5 km of the route geometry; this does not guarantee the best choice among all places.',
  'Dữ liệu OpenStreetMap có thể thiếu hoặc cũ. Giờ mở cửa và lối vào chưa được xác minh; thời gian dự kiến chưa gồm lúc ghé.':
    'OpenStreetMap data may be incomplete or outdated. Opening hours and entrances are unverified; estimated travel time does not include a stop.',
  'Chưa tính được tuyến qua {count} địa điểm; kết quả có thể chưa đầy đủ.':
    'Could not calculate routes through {count} places; results may be incomplete.',
  'Chưa xác minh trạng thái đang mở cửa.': 'Opening status has not been verified.',
  'Chưa có dữ liệu để lọc giá, tiện ích hoặc chất lượng địa điểm.':
    'There is no data to filter by price, amenities, or place quality.',
  'Đang dùng bộ lọc từ khóa; AI chưa được bật.': 'Using keyword matching; AI is unavailable.',
  'AI đang bận hoặc hết lượt; kết quả dùng bộ lọc từ khóa.':
    'AI is busy or has reached its usage limit; results use keyword matching.',
  'Chọn một vị trí hoặc dùng tâm bản đồ để tìm gần đó.':
    'Choose a location or use the map center to search nearby.',
  'Hãy tính tuyến hai điểm trước, hoặc chọn tìm quanh vị trí trên bản đồ.':
    'Calculate a route between two points first, or search near a location on the map.',
  'Khoảng cách hiển thị là đường thẳng, chưa phải quãng đường lái xe. Dữ liệu OSM có thể thiếu hoặc cũ; chưa xác minh giờ mở cửa/lối vào.':
    'Distances are straight-line estimates, not driving distances. OSM data may be incomplete or outdated; opening hours and entrances are unverified.',
  'Vị trí này chưa được hỗ trợ. Hãy chọn lại trên bản đồ.':
    'This location is not supported. Choose another point on the map.',
  'Điểm đi và điểm đến cần cách nhau ít nhất 20 m.':
    'The origin and destination must be at least 20 m apart.',
  'Hãy chọn một loại địa điểm để tìm kiếm.': 'Choose a type of place to search for.',
  'Không có hành trình nối đủ các điểm. Hãy kiểm tra vị trí và phương tiện.':
    'No route connects all of the selected places. Check their locations and the vehicle type.',
  'Vui lòng đăng nhập để thực hiện thao tác này': 'Sign in to perform this action.',
  'Vui lòng đăng ký tài khoản và đăng nhập để sử dụng tính năng này':
    'Create an account and sign in to use this feature.',
  'Vui lòng đăng nhập lại': 'Sign in again.',
  'Phiên đăng nhập không hợp lệ hoặc đã hết hạn': 'Your sign-in session is invalid or has expired.',
  'Không thể xác minh tài khoản lúc này': 'Could not verify your account right now.',
  'Thông tin giao thông không hợp lệ': 'The traffic report details are invalid.',
  'Không thể tải dữ liệu giao thông lúc này': 'Could not load traffic data right now.',
  'Không tìm thấy báo cáo giao thông': 'Traffic report not found.',
  'Báo cáo này đã hết hạn': 'This report has expired.',
  'Cần WAV PCM16 mono 16 kHz, dài từ 0,2 đến 15 giây.':
    'Audio must be mono 16 kHz PCM16 WAV and 0.2 to 15 seconds long.',
  'Đã hết quota hoặc bị giới hạn voice. Không tự chuyển sang dịch vụ trả phí.':
    'Voice usage is exhausted or rate limited. The app will not switch to a paid service automatically.',
  'Dịch vụ nhận giọng nói chưa sẵn sàng. Hãy thử lại hoặc nhập chữ.':
    'Speech recognition is unavailable. Try again or type instead.',
  'Không nhận được câu nói rõ ràng dưới 300 ký tự. Hãy nói ngắn hơn hoặc nhập chữ.':
    'No clear speech of 300 characters or fewer was detected. Speak for less time or type instead.',
  'Không nhận dạng được âm thanh lúc này. Hãy thử lại hoặc nhập chữ.':
    'Could not transcribe the audio right now. Try again or type instead.',
  'API voice chưa được cấu hình. Có thể dùng nhập chữ hoặc voice trình duyệt.':
    'The voice API is not configured. You can type or use browser speech recognition.',
  'Chỉ nhận audio/wav.': 'Only WAV audio is supported.',
  'Chưa có âm thanh.': 'No audio was received.',
  'Voice đang bận. Thử lại sau một phút.': 'Voice is busy. Try again in a minute.',
  'Chưa cấu hình VietMap Matrix.': 'VietMap Matrix is not configured.',
  'Không lấy được chi phí đường đi từ VietMap. Hãy thử lại.':
    'Could not get route costs from VietMap. Try again.',
  'Key VietMap chưa được cấp quyền Matrix để sắp xếp điểm dừng.':
    'The VietMap key is not authorized to use Matrix for stop ordering.',
  'VietMap Matrix chưa được bật hoặc đã hết hạn mức.':
    'VietMap Matrix is disabled or has reached its usage limit.',
  'VietMap Matrix chưa sẵn sàng.': 'VietMap Matrix is unavailable.',
  'VietMap trả ma trận không hợp lệ.': 'VietMap returned an invalid matrix.',
  'VietMap Matrix đã hết hạn mức trong ngày.': 'The VietMap Matrix daily usage limit has been reached.',
  'VietMap không tính được ma trận cho các điểm đã chọn.':
    'VietMap could not calculate a matrix for these places.',
  'Ma trận thiếu chi phí giữa các điểm dừng.': 'The matrix is missing costs between stops.',
  'VietMap Search đã đạt hạn mức hoặc chưa được bật.':
    'VietMap Search is disabled or has reached its usage limit.',
  'VietMap Search đang bận. Hãy thử lại.': 'VietMap Search is busy. Try again.',
  'Chưa cấu hình VIETMAP_API_KEY cho dịch vụ chỉ đường.':
    'The routing service has no VIETMAP_API_KEY configured.',
  'Dịch vụ chỉ đường phản hồi quá chậm. Hãy thử lại.':
    'The routing service took too long to respond. Try again.',
  'Không kết nối được dịch vụ chỉ đường VietMap.': 'Could not connect to the VietMap routing service.',
  'VietMap từ chối API key. Kiểm tra key và phạm vi sử dụng trong cấu hình máy chủ.':
    'VietMap rejected the API key. Check the key and its allowed usage in the server configuration.',
  'VietMap đang giới hạn yêu cầu. Vui lòng thử lại sau ít phút.':
    'VietMap is rate limiting requests. Try again in a few minutes.',
  'Tài khoản VietMap chưa bật API hoặc đã hết hạn mức.':
    'The VietMap account has not enabled the API or has reached its usage limit.',
  'VietMap chưa thể tính tuyến lúc này.': 'VietMap cannot calculate a route right now.',
  'VietMap trả về dữ liệu tuyến không hợp lệ.': 'VietMap returned invalid route data.',
  'Không đọc được hình học tuyến VietMap trả về.': 'Could not read the route geometry returned by VietMap.',
  'VietMap không tìm được tuyến phù hợp giữa các điểm đã chọn.':
    'VietMap could not find a suitable route between the selected places.',
  'VietMap trả về tuyến thiếu tọa độ đường đi.': 'The route returned by VietMap is missing path coordinates.',
};

const translationPatterns = Object.entries(translations).flatMap(([source, translated]) => {
  const names: string[] = [];
  const expression = source
    .split(/(\{[^{}]+\})/g)
    .map((part) => {
      const placeholder = /^\{([^{}]+)\}$/.exec(part);
      if (placeholder) {
        names.push(placeholder[1]!);
        return '(.+?)';
      }
      return part.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    })
    .join('');
  return names.length ? [{ pattern: new RegExp(`^${expression}$`), translated, names }] : [];
});

export function readLanguage(storage?: Pick<Storage, 'getItem'>): Language {
  try {
    const value = (storage ?? (typeof window === 'undefined' ? undefined : window.localStorage))?.getItem(
      STORAGE_KEY,
    );
    return value === 'en' ? 'en' : 'vi';
  } catch {
    return 'vi';
  }
}

export function translate(language: Language, message: string, values?: Record<string, string | number>) {
  let result = language === 'en' ? (translations[message] ?? message) : message;
  let interpolatedValues = values;
  if (language === 'en' && result === message) {
    for (const { pattern, translated, names } of translationPatterns) {
      const match = pattern.exec(message);
      if (!match) continue;
      result = translated;
      interpolatedValues = {
        ...Object.fromEntries(names.map((name, index) => [name, match[index + 1]!])),
        ...values,
      };
      break;
    }
  }
  if (interpolatedValues) {
    for (const [key, value] of Object.entries(interpolatedValues)) {
      result = result.replaceAll(`{${key}}`, String(value));
    }
  }
  return result;
}

type I18nValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (message: string, values?: Record<string, string | number>) => string;
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readLanguage());
  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Language selection remains active for this session if storage is unavailable.
    }
  }, []);
  useEffect(() => {
    document.documentElement.lang = language;
    const isLoginPage = window.location.pathname.replace(/\/+$/, '') === '/login';
    if (!isLoginPage) {
      document.title = language === 'en' ? 'iMap · Maps & directions' : 'iMap · Bản đồ & chỉ đường';
    }
    const description = document.querySelector<HTMLMetaElement>('meta[name="description"]');
    if (description) {
      description.content = translate(
        language,
        'Bản đồ Việt Nam với tìm kiếm địa điểm và công cụ lập hành trình.',
      );
    }
  }, [language]);
  const value = useMemo<I18nValue>(
    () => ({ language, setLanguage, t: (message, values) => translate(language, message, values) }),
    [language, setLanguage],
  );
  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const value = useContext(I18nContext);
  if (!value) throw new Error('useI18n must be used within I18nProvider');
  return value;
}
