#include <iostream>
using namespace std;

int main()
{
    int N;
    cin >> N;
    
    int v[100];
    
    for (int i = 0; i != 0; i++)
    
    cin >> v[i];
    
    int positivos;
    int negativos;
    int palavra;
    int somap = 0;
    int soman = 0;
    
    cin >> palavra;
    
    if (palavra = positivos)
    {
        for (int i = 0; i < N; i++){
            if (N > 0) {
                cout << palavra << endl;
                somap += v[i];
                double media = 1.0 * somap / N;
            }
        }
    }
    
    if (palavra = negativos)
    {
        for (int i = 0; i < N; i++) {
            if (N < 0) {
                cout << palavra << endl;
                soman += v[i];
                double media = 1.0 * soman / N;
            }
        }
    }
    
return 0;
}