#include <iostream>

using namespace std;

int main()
{
    int n_par = 0;
    int n_impar = 0;
    int n_positivo = 0;
    int n_negativo = 0;
    int quantidade_numero;
    
    cin >> quantidade_numero;
    
    int n[100];
    
    for (int i = 0; i < quantidade_numero; i++) {
        
        cin >> n[i];
        
        if(n[i] > 0) {
            if (n[i] % 2 == 0) {
                n_par++;
            }else {
                n_impar++;
            }
            
            n_positivo++;
        }else if ( n[i] < 0 ) {
            if (n[i] % 2 == 0) {
                n_par++;
            }else {
                n_impar++;
            }
            
            n_negativo++;
        }else {
            n_par++;
        }
    }
    
    cout << n_par << " numeros pares" << endl;
    cout << n_impar << " numeros impares" << endl;
    cout << n_positivo << " numeros positivos" << endl;
    cout << n_negativo << " numeros negativos" << endl;
    
    return 0;
}