#include <iostream>

using namespace std;

int main() {
    
    int num, raz, resul, cont;
    
    cin >> cont >> num >> raz;
    resul = num;
    
    for (int i = 0; i < cont; i++) {
        cout << resul << " ";
        
        resul = num + raz;
        num = resul;
    }
    
    return 0;
}