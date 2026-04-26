#include <iostream>
#include <iomanip>
using namespace std;

int main() {
    
    int N, num;
    double soma, media;
    cin >> N;
    
    for (int i = 0; i < 1; i++) {
        cin >> num;
        
        if (num % 2 != 0) {
            soma += num;
        }
        
    }
        cout << fixed << setprecision(4);
        cout << soma << endl;
    
    return 0;
}