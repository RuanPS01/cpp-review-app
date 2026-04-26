#include <iostream>
#include <string>
#include <iomanip>

using namespace std;

int main() {
    
    int v[100], num, media = 0, soma = 0;
    
    while(cin >> num) {
        soma += num;
    }
    
    cout << setprecision(3) << "media = " << media << endl;
    
}