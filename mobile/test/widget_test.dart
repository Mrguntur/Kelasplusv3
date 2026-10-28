import 'package:flutter_test/flutter_test.dart';
import 'package:kelasplus_mobile/main.dart';

void main() {
  testWidgets('shows KELAS+ staging shell and role areas',
      (WidgetTester tester) async {
    await tester.pumpWidget(const KelasPlusApp());

    expect(find.text('KELAS+'), findsOneWidget);
    expect(find.text('Admin'), findsOneWidget);
    expect(find.text('Pimpinan Sekolah'), findsOneWidget);
    expect(find.text('Guru'), findsOneWidget);
    expect(find.text('Dari Data Menjadi Aksi'), findsOneWidget);
  });
}
