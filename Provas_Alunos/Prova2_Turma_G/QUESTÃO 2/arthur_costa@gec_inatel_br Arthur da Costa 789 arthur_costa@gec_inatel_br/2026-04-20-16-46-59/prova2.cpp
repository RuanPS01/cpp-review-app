#include <iostream>
#include <iomanip> // por conta do setprecision

using namespace std;

int main() 
{
    int quantidade_numero;
    int n[100];
    double media = 0;
    
    cin >> quantidade_numero;
    
    for (int i = 0; i < quantidade_numero; i++) {
        cin >> n[i];
        
        media = media + n[i];
    }
    
    cout << fixed << setprecision(4) << endl;
    cout << media / quantidade_numero << endl;
    
    return 0;
}