#include <iostream>
#include <iomanip>

using namespace std;

int main (){
    
    int N;
    double numeros;
    double soma = 0;
    double media;
    
    cin >> N;
    
    for (int i = 0; i < N; i++){
        cin >> numeros;
        soma += numeros;
    }
    
    media = soma / N;
    
    cout << fixed << setprecision (4);
    cout << media << endl;
    
    return 0;
}